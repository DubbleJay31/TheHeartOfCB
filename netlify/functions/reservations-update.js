const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

// Admin-only field update: the private host_notes field, and soft-cancelling a reservation
// (status -> 'cancelled', row retained rather than deleted - a hard delete is a separate,
// rarely-used cleanup action in reservations-delete.js).
exports.handler = async function(event) {
  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const code = (event.queryStringParameters || {}).code;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const patch = {};
  if (typeof body.host_notes === 'string') patch.host_notes = body.host_notes;
  if (body.status === 'cancelled') {
    patch.status = 'cancelled';
    patch.cancelled_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Nothing to update' }) };
  }
  patch.updated_at = new Date().toISOString();

  const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
  return { statusCode: r.ok ? 204 : r.status, body: '' };
};
