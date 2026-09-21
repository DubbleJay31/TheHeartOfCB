const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

// Puts a change-pending reservation back exactly as it was before a Change Reservation edit -
// the counterpart to reservations-upsert.js's prior_terms snapshot. Admin-only: this is Jesse
// deciding not to go through with an edit, not something a guest capability token should ever
// be able to trigger.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code } = body;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  try {
    const curResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=prior_terms`);
    const cur = curResp.ok ? await curResp.json() : [];
    if (!cur.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, message: 'No reservation found for that code' }) };
    }
    const snapshot = cur[0].prior_terms;
    if (!snapshot) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Nothing to revert - no prior terms on file' }) };
    }

    const row = { ...snapshot, prior_terms: null, cancelled_at: null, updated_at: new Date().toISOString() };

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
