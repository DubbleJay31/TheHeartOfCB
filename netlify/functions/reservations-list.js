const { requireAdmin } = require('./_auth');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  const r = await fetch(`${SB_URL}/rest/v1/reservations?order=check_in.asc&select=*`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  const body = await r.text();
  return {
    statusCode: r.status,
    headers: { 'Content-Type': 'application/json' },
    body
  };
};
