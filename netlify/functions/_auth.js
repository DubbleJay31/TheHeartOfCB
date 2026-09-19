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
  // Every admin-gated function calls requireAdmin() -> verify() without checking this env var
  // itself first (only admin-login.js does) - without this guard, a misconfigured deploy throws
  // a raw TypeError out of crypto.createHmac(undefined) instead of a clean 401, for every one of
  // those functions at once.
  if (!secret) return null;
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
