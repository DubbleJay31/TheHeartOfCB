const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

// True permanent delete - a rarely-used cleanup action (e.g. removing a junk test entry), kept
// separate from the normal Cancel flow (reservations-update.js, status -> 'cancelled', which
// keeps the row).
exports.handler = async function(event) {
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const code = (event.queryStringParameters || {}).code;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
    method: 'DELETE'
  });
  return { statusCode: r.ok ? 204 : r.status, body: '' };
};
