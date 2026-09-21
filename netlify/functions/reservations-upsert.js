const { requireAdmin } = require('./_auth');
const { sbReservations, genCode, propLabel } = require('./_reservations');

// Admin-authenticated. No `code` in the body -> insert a new row (status 'quoted'). `code`
// present -> update that row in place. This single endpoint replaces both "save a new quote"
// and "Change Reservation" (editing an existing booking's terms) - both are really the same
// operation, updating a row's terms and resetting it to 'quoted' pending re-signing.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, guest, email, phone, prop, ci, co, nights, total, rate, taxOcc, taxSales, url, exp, privateNote, credit, contactPref } = body;
  if (!guest || !ci || !co) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing guest, ci, or co' }) };
  }

  const row = {
    guest, email: email || '', phone: phone || '',
    prop: prop || '', prop_label: propLabel(prop),
    check_in: ci, check_out: co, nights: nights || 0,
    total: parseFloat(total) || 0,
    rate: rate != null ? parseFloat(rate) || 0 : null,
    tax_occ: taxOcc != null ? parseFloat(taxOcc) || 0 : null,
    tax_sales: taxSales != null ? parseFloat(taxSales) || 0 : null,
    url: url || '',
    exp: exp || null,
    host_notes: privateNote || null,
    credit: credit != null ? parseFloat(credit) || 0 : 0,
    contact_pref: contactPref || null,
    status: 'quoted',
    // Clears any stale cancelled_at when this is a reinstate (editing a cancelled reservation
    // back to active) - harmless no-op otherwise, since it's already null on everything else.
    cancelled_at: null,
    updated_at: new Date().toISOString()
  };

  try {
    if (code) {
      // This endpoint used to force status back to 'quoted' unconditionally on every edit -
      // including a pure link resend or a private-note tweak with no term changes at all. That
      // silently un-confirmed real, paid bookings (dropping them out of the confirmed-only
      // conflict scan AND all three cron reminder functions) just from clicking "Copy Link" on
      // an already-confirmed reservation. Now: if the row is currently confirmed OR signed and
      // none of the guest-facing terms actually changed, leave status/cancelled_at untouched -
      // only a real change to dates/price genuinely needs re-signing. `signed` matters just as
      // much as `confirmed` here - a reservation the guest already signed (say, resending their
      // link because they lost it) was still getting silently knocked back to `quoted`, losing
      // that signed state in the dashboard even though signed_name/signed_at never actually
      // changed. This read also catches a stale/deleted `code` before the write, instead of
      // PATCHing zero rows and reporting success anyway.
      const curResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,total,rate,tax_occ,tax_sales,check_in,check_out,guest,email,phone,prop,prop_label,nights,url,host_notes,credit,contact_pref,signed_name,signed_at,cancelled_at,prior_terms`);
      const cur = curResp.ok ? await curResp.json() : [];
      if (!cur.length) {
        return { statusCode: 404, body: JSON.stringify({ ok: false, message: 'No reservation found for that code' }) };
      }
      const c = cur[0];
      const sameTerms = c.check_in === row.check_in && c.check_out === row.check_out
        && Math.abs((parseFloat(c.total) || 0) - row.total) < 0.01
        && Math.abs((parseFloat(c.rate) || 0) - (row.rate || 0)) < 0.01
        && Math.abs((parseFloat(c.tax_occ) || 0) - (row.tax_occ || 0)) < 0.01
        && Math.abs((parseFloat(c.tax_sales) || 0) - (row.tax_sales || 0)) < 0.01;
      // `cancelled` matters here too, same reasoning as confirmed/signed - a private-note tweak
      // or a Copy Link on an already-cancelled reservation used to silently reactivate it (status
      // unconditionally reset to 'quoted') just from editing something that has nothing to do with
      // dates or price. Only a real term change should ever reactivate a cancelled row.
      if ((c.status === 'confirmed' || c.status === 'signed' || c.status === 'cancelled') && sameTerms) {
        delete row.status;
        delete row.cancelled_at;
      } else if ((c.status === 'confirmed' || c.status === 'signed' || c.status === 'cancelled') && !c.prior_terms) {
        // Terms are genuinely changing on a reservation that was already confirmed/signed/cancelled
        // - stash everything needed to put it back exactly as it was if Jesse decides not to go
        // through with the change after all (admin's "Keep Original Terms" button,
        // reservations-revert.js restores whatever status this snapshot carries, cancelled
        // included). Skipped if a snapshot is already sitting there unresolved - that first
        // snapshot is the true prior state; a second edit before the first is resolved must not
        // overwrite it with an already-changed intermediate state.
        const { prior_terms, ...snapshot } = c;
        row.prior_terms = snapshot;
      }

      const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(row)
      });
      if (!r.ok) {
        const err = await r.text();
        return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
      }
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code }) };
    }

    // New quote - generate a code, retry once on the unlikely chance of a collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const newCode = genCode();
      const r = await sbReservations('', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...row, code: newCode })
      });
      if (r.ok) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code: newCode }) };
      }
      const err = await r.text();
      if (!err.includes('reservations_code_unique') && !err.includes('23505')) {
        return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
      }
      // else: code collision, loop and try a fresh one
    }
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: 'Could not generate a unique reservation code' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
