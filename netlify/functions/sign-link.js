const crypto = require('crypto');

function validQuoteToken(body) {
  if (!process.env.LINK_SECRET || !body.qtok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.ci}|${body.co}|${body.prop}|${body.total}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.qtok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

// Mints a capability token for a specific guest+dates, embedded in the booking link
// at signing time. reservations-confirm.js later verifies this token instead of trusting
// a bare POST - closes the "anyone who finds the endpoint can inject a fake reservation" gap
// without requiring a fresh admin PIN entry when Jesse taps the one-click confirm link on his phone.
//
// This alone used to sign whatever guest/email/dates a caller handed it, with no proof any
// of it came from a real quote - so it required a "qtok" (minted admin-side by
// mint-quote-token.js, over guest/email/ci/co/prop/total) proving Jesse actually generated
// this exact quote, before it will mint a signing token at all.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.LINK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'LINK_SECRET not configured' }) };
  }

  // This is called from the guest's own booking page while they're signing - not an admin
  // session - so it isn't PIN-gated. It only ever signs the exact guest/dates it's given,
  // which the guest already sees on their own booking page.
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { guest, email, ci, co } = body;
  if (!guest || !email || !ci || !co) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing guest, email, ci, or co' }) };
  }
  if (!validQuoteToken(body)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'This booking link is missing or has an invalid quote signature - ask Jesse to resend it.' }) };
  }

  const tok = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${guest}|${email}|${ci}|${co}`)
    .digest('hex');

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tok, ip })
  };
};
