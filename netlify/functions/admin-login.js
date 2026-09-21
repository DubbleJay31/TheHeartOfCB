const crypto = require('crypto');
const { sign } = require('./_auth');

const SESSION_HOURS = 12;

// Best-effort lockout - state lives in this container's memory, so it resets on a cold start and
// doesn't coordinate across concurrent containers (same honest limitation as send-email.js's rate
// limit). There's exactly one legitimate user of this endpoint, so a single shared counter (not
// per-IP) is simpler and just as effective here - no legitimate second user to accidentally lock
// out. Meaningfully slows down a sustained guessing attempt beyond what the flat 600ms delay alone
// did, without needing new Supabase state for a single-admin app.
let _failedAttempts = 0;
let _lockedUntil = 0;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 2 * 60 * 1000;

// Timing-safe compare needs equal-length buffers - pad/truncate is fine here since a length
// mismatch alone already means "wrong PIN" and doesn't need to leak timing either way.
function pinMatches(submitted, actual) {
  const a = Buffer.from(String(submitted || ''));
  const b = Buffer.from(String(actual));
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.from(b).fill(0), Buffer.from(b).fill(0)); // constant-time no-op, keeps timing flat on length mismatch too
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.ADMIN_PIN || !process.env.ADMIN_SESSION_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Admin auth not configured' }) };
  }

  const now = Date.now();
  if (now < _lockedUntil) {
    const waitSec = Math.ceil((_lockedUntil - now) / 1000);
    return { statusCode: 429, body: JSON.stringify({ message: `Too many failed attempts - try again in ${waitSec}s.` }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  if (!pinMatches(body.pin, process.env.ADMIN_PIN)) {
    _failedAttempts++;
    if (_failedAttempts >= LOCKOUT_THRESHOLD) {
      _lockedUntil = now + LOCKOUT_MS;
      _failedAttempts = 0;
    }
    // Small fixed delay to blunt trivial brute-forcing without needing external state.
    await new Promise(r => setTimeout(r, 600));
    return { statusCode: 401, body: JSON.stringify({ message: 'Incorrect PIN' }) };
  }

  _failedAttempts = 0;
  const token = sign({ exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  };
};
