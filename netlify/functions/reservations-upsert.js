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
