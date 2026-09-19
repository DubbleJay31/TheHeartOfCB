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

  try {
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' }
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ message: err }) };
    }
    const deleted = await r.json().catch(() => []);
    if (!deleted.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No reservation found for that code' }) };
    }
    return { statusCode: 204, body: '' };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
