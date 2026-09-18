const { requireAdmin } = require('./_auth');

// Admin-only field update - currently just the private host_notes field, kept separate from
// reservations-confirm.js since this is an edit to an existing row, not a new booking.
exports.handler = async function(event) {
  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing id' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const patch = {};
  if (typeof body.host_notes === 'string') patch.host_notes = body.host_notes;
  if (!Object.keys(patch).length) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Nothing to update' }) };
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  const r = await fetch(`${SB_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
  return { statusCode: r.ok ? 204 : r.status, body: '' };
};
