const crypto = require('crypto');
const { sbReservations } = require('./_reservations');

// Same capability token sign-link.js mints (guest|email|check_in|check_out|code) and
// reservations-confirm.js already verifies - reused here rather than inventing a second scheme.
function validCapabilityToken(body) {
  if (!process.env.LINK_SECRET || !body.tok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.check_in}|${body.check_out}|${body.code}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.tok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

// Guest-facing, capability-token-authenticated. Records what the guest SELF-REPORTS paying by
// when they click "I've sent it" on a manual payment method (Venmo/Cash App/Zelle/PayPal) -
// purely informational for Jesse to see in the Guest Dashboard before he actually confirms.
// `payment_method` itself stays untouched here - that column is only ever written, authoritatively,
// by reservations-confirm.js once Jesse verifies the money actually landed and confirms for real.
// Jesse, looking at a signed-but-not-yet-confirmed reservation the guest had paid via PayPal: "I
// understand it's not confirmed by me yet but why can't that info be there now? that would be
// helpful to me at this stage."
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, guest, email, check_in, check_out, method } = body;
  if (!code || !guest || !check_in || !check_out || !method) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code, guest, check_in, check_out, or method' }) };
  }
  if (!validCapabilityToken(body)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or missing capability token' }) };
  }
  try {
    // Scoped to status=signed - once actually confirmed, the real payment_method column is
    // authoritative and a self-report from before that point is stale/irrelevant.
    await sbReservations(`?code=eq.${encodeURIComponent(code)}&status=eq.signed`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ reported_payment_method: method, updated_at: new Date().toISOString() })
    });
  } catch (e) {
    // Best-effort - the guest's own "you're all set" flow never depends on this succeeding.
    console.error('reservations-report-payment failed:', e);
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
