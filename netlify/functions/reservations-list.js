const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const status = (event.queryStringParameters || {}).status;
  const statusFilter = status ? `&status=eq.${encodeURIComponent(status)}` : '';

  try {
    const r = await sbReservations(`?order=check_in.asc&select=*${statusFilter}`);
    const body = await r.text();
    return {
      statusCode: r.status,
      headers: { 'Content-Type': 'application/json' },
      body
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
