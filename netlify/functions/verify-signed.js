const crypto = require('crypto');

// Public, read-only. Lets book.html confirm a link's `tok` is genuinely valid before rendering
// the "signed agreement" print view, instead of trusting the bare `signed=1` URL flag alone -
// anyone could add that to any copy of a quote link with zero effort and get a convincing but
// entirely fake "signed" page, with no real signature and nothing having touched the server.
// Mirrors the exact same check reservations-confirm.js's validCapabilityToken() already does for
// the actual database write - this just exposes a read-only "would this tok pass" check for
// rendering purposes. It grants no write capability of its own.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.LINK_SECRET) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valid: false }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { guest, email, check_in, check_out, code, tok } = body;
  if (!guest || !email || !check_in || !check_out || !code || !tok) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valid: false }) };
  }

  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${guest}|${email}|${check_in}|${check_out}|${code}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(tok), 'hex');
  const valid = expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valid }) };
};
