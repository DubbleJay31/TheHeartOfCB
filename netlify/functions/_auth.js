const crypto = require('crypto');

// Shared session-token helpers for admin-gated functions.
// Token shape: base64url(JSON payload) + '.' + hex HMAC-SHA256 of that payload, using ADMIN_SESSION_SECRET.
// Stateless on purpose - no server-side session store to manage for a solo-admin dashboard.

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `${body}.${mac}`;
}

function verify(token) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const macBuf = Buffer.from(mac, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (macBuf.length !== expBuf.length || !crypto.timingSafeEqual(macBuf, expBuf)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function requireAdmin(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return verify(token);
}

module.exports = { sign, verify, requireAdmin };
