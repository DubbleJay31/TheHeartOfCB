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
  const { code, guest, email, check_in, check_out, total, rate, tax_occ, tax_sales, signed_ip, host_notes, contact_pref } = body;
  if (!code || !guest || !check_in || !check_out) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code, guest, check_in, or check_out' }) };
  }

  // Two valid ways in: a logged-in admin session (the manual "Confirm" button on a quote), or a
  // per-booking capability token minted by sign-link.js at signing time (the one-click confirm
  // link in the "Payment Sent" email, which isn't an admin session).
  if (!requireAdmin(event) && !validCapabilityToken(body)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  try {
    const existingResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status`);
    const existing = existingResp.ok ? await existingResp.json() : [];
    if (!existing.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, message: 'No reservation found for that code' }) };
    }
    if (existing[0].status === 'confirmed') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const row = {
      status: 'confirmed',
      updated_at: new Date().toISOString(),
      total: parseFloat(total) || 0,
      rate: rate != null ? parseFloat(rate) || 0 : null,
      tax_occ: tax_occ != null ? parseFloat(tax_occ) || 0 : null,
      tax_sales: tax_sales != null ? parseFloat(tax_sales) || 0 : null,
      signed_ip: signed_ip || null,
      contact_pref: contact_pref || null
    };
    if (host_notes) row.host_notes = host_notes;

    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
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
