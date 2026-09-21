const crypto = require('crypto');
const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

function validCapabilityToken(body) {
  if (!process.env.LINK_SECRET || !body.tok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.check_in}|${body.check_out}|${body.code}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.tok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

// Marks the reservation identified by `code` as confirmed - an UPDATE on the one row that's
// existed since the guest's original inquiry/quote, not an insert. This is what replaces the
// old fuzzy-URL-matching dedup and the whole "insert new row, delete the superseded one" dance
// for Change Reservation: with a stable code, there's never a window where two rows exist for
// the same booking, so there's nothing left to reconcile.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, guest, email, check_in, check_out, total, rate, tax_occ, tax_sales, signed_ip, host_notes, contact_pref, payment_method, mark_sent } = body;
  if (!code || !guest || !check_in || !check_out) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code, guest, check_in, or check_out' }) };
  }

  // Only ever set once - marks that the FULL confirmation (door code, house rules, etc. - what
  // sendGuestConfirmation()/sendGuestConfirmationText() actually deliver) has gone out at least
  // once, as distinct from the reservation merely being status='confirmed' (which can happen with
  // nobody notified yet, e.g. admin's quick-confirm list button). Lets admin.html's detail-modal
  // button say "Resend" only when something was truly already sent, not just whenever status
  // happens to be confirmed.
  async function _markSentIfNeeded(row) {
    if (!mark_sent || row.confirmation_sent_at) return;
    await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ confirmation_sent_at: new Date().toISOString() })
    }).catch(e => console.error('Failed to mark confirmation_sent_at:', e));
  }

  try {
    const existingResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,guest,check_in,check_out,rate,tax_occ,tax_sales,total,credit,confirmation_sent_at`);
    const existing = existingResp.ok ? await existingResp.json() : [];

    // Already confirmed, and the caller already knows this exact reservation's guest/dates (not
    // just a guessed code) - report success without requiring the capability token. This is the
    // normal case when Jesse confirms manually in Admin first, then goes to book.html's one-click
    // link afterward just to send the guest notification: by then there's no write left to
    // authorize, so gating on `tok` here only produced a false "save failed" for a reservation
    // that was already saved.
    if (existing.length && existing[0].status === 'confirmed'
        && existing[0].guest === guest && existing[0].check_in === check_in && existing[0].check_out === check_out) {
      await _markSentIfNeeded(existing[0]);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    // Two valid ways in for an actual write: a logged-in admin session (the manual "Confirm"
    // button on a quote), or a per-booking capability token minted by sign-link.js at signing
    // time (the one-click confirm link in the "Payment Sent" email, which isn't an admin session).
    if (!requireAdmin(event) && !validCapabilityToken(body)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    }

    if (!existing.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, message: 'No reservation found for that code' }) };
    }
    if (existing[0].status === 'confirmed') {
      await _markSentIfNeeded(existing[0]);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
    }
    // A valid `tok` only proves identity/dates match - it's handed to the guest's own browser at
    // signing time and never expires, so without this, a guest could read it out of their own
    // network tab and call this endpoint directly to self-confirm without ever paying, or replay
    // it weeks later to silently resurrect a reservation Jesse has since cancelled. `confirmed`
    // may only ever be reached from `signed` - the one status that means "agreement signed,
    // payment pending, nothing else legitimately confirms this."
    if (existing[0].status !== 'signed') {
      return { statusCode: 409, body: JSON.stringify({ ok: false, message: 'This reservation is not awaiting confirmation.' }) };
    }

    // The capability token (`tok`) only proves identity/dates match, never money - a guest who
    // holds a valid tok (which they legitimately do once signed) could otherwise submit any
    // total/rate/tax figures here and have them written as the confirmed reservation's permanent
    // record, with no payment required. rate/tax_occ/tax_sales are set once, by Jesse, when the
    // quote is built - they never legitimately differ from what's already on the row, so the
    // request body's copies are ignored in favor of the DB's own values. `total` alone is allowed
    // to differ (a credit-flow confirm may legitimately record the full pre-credit stay value for
    // bookkeeping, per the comment below) - but never DOWN from the floor those trusted fields
    // establish, which is the only direction that could let a guest avoid paying.
    const dbRate = parseFloat(existing[0].rate) || 0;
    const dbTaxOcc = parseFloat(existing[0].tax_occ) || 0;
    const dbTaxSales = parseFloat(existing[0].tax_sales) || 0;
    const dbCredit = parseFloat(existing[0].credit) || 0;
    const totalFloor = Math.max(0, dbRate + dbTaxOcc + dbTaxSales - dbCredit);
    const submittedTotal = parseFloat(total) || 0;
    // Record the full stay value here, not just today's balance - rate/tax_occ/tax_sales below
    // are always full-stay figures, so total needs to match them for the numbers to add up in
    // the admin dashboard and any tax reporting.
    const row = {
      status: 'confirmed',
      // Clears any snapshot reservations-upsert.js stashed for a pending change - the change
      // just became the real, confirmed reservation, so there's nothing left to revert to.
      prior_terms: null,
      updated_at: new Date().toISOString(),
      total: submittedTotal >= totalFloor - 0.01 ? submittedTotal : (parseFloat(existing[0].total) || totalFloor),
      rate: dbRate,
      tax_occ: dbTaxOcc,
      tax_sales: dbTaxSales,
      signed_ip: signed_ip || null,
      contact_pref: contact_pref || null
    };
    // Separate from `total` (which the NEXT Change Reservation edit will overwrite with the new,
    // not-yet-paid terms) - this is a dedicated record of what was actually collected THIS confirm,
    // so admin.html's credit auto-fill can still find the real fee rate on a reservation's second
    // or later edit, not just its first (previously derived straight from `total`/`!r.credit`,
    // which broke the moment a second edit's total no longer matched what was actually paid).
    row.last_paid_total = row.total;
    // This branch only ever runs on a signed->confirmed transition - the very first confirm this
    // reservation has ever had, so confirmation_sent_at can't already be set here.
    if (mark_sent) row.confirmation_sent_at = new Date().toISOString();
    if (host_notes) row.host_notes = host_notes;
    if (payment_method) row.payment_method = payment_method;

    // Scoped to status=eq.signed (not just code) so two near-simultaneous requests can't both
    // pass the status check above and both write - only the first to actually commit still
    // matches this filter, the second affects zero rows.
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}&status=eq.signed`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
