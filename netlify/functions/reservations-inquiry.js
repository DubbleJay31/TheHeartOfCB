const { sbReservations, genCode, propLabel } = require('./_reservations');

// Public, unauthenticated - this is the guest-facing "Send Booking Request" path on the public
// site. Replaces cloud-sync.js's old inquiry branch: instead of appending to a JSONBin array
// with no identity, this creates the one row that will carry this booking through its whole
// lifecycle (inquiry -> quoted -> signed -> confirmed), identified by `code` from here on.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { first, last, email, phone, prop, ci, co, guests, pets, message, contactPref, rate } = body;
  if (!email || !ci || !first) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing first, email, or ci' }) };
  }

  try {
    // Same dedup as before: don't create a second row for a guest re-submitting the same dates.
    const checkResp = await sbReservations(
      `?email=eq.${encodeURIComponent(email)}&check_in=eq.${encodeURIComponent(ci)}&select=code`
    );
    const existing = checkResp.ok ? await checkResp.json() : [];
    if (existing.length > 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code: existing[0].code, skipped: true }) };
    }

    const code = genCode();
    const row = {
      code, status: 'inquiry',
      first_name: first, last_name: last || '', guest: [first, last].filter(Boolean).join(' '),
      email, phone: phone || '',
      prop: prop || '', prop_label: propLabel(prop),
      check_in: ci, check_out: co || null,
      guests_count: guests || '', pets: pets || '', message: message || '',
      contact_pref: contactPref || null,
      rate: rate != null ? parseFloat(rate) || 0 : null
    };

    const r = await sbReservations('', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
