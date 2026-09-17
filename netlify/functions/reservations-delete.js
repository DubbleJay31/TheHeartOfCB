const { requireAdmin } = require('./_auth');

exports.handler = async function(event) {
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing id' }) };
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  const r = await fetch(`${SB_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  return { statusCode: r.ok ? 204 : r.status, body: '' };
};
