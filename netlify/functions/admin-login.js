const { sign } = require('./_auth');

const SESSION_HOURS = 12;

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.ADMIN_PIN || !process.env.ADMIN_SESSION_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Admin auth not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  if (body.pin !== process.env.ADMIN_PIN) {
    // Small fixed delay to blunt trivial brute-forcing without needing external state.
    await new Promise(r => setTimeout(r, 600));
    return { statusCode: 401, body: JSON.stringify({ message: 'Incorrect PIN' }) };
  }

  const token = sign({ exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  };
};
