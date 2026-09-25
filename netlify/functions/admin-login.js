const crypto = require('crypto');
const { sign } = require('./_auth');
const { sbHeaders, SB_URL } = require('./_reservations');

const SESSION_HOURS = 12;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 2 * 60 * 1000;

// SECURITY FIX (overnight audit 2026-09-25): this used to be a plain in-memory counter, which
// only coordinates within one warm container - Netlify Functions scale out to multiple concurrent
// execution environments under parallel load, so a concurrent (not just sequential) guesser could
// largely evade the 5-attempt lockout, since each parallel request had a real chance of hitting a
// fresh container with its own zeroed counter. Persisted to a single shared Supabase row instead -
// there's exactly one legitimate user of this endpoint, so one row (not per-IP) is simpler and
// just as effective, matching the original in-memory design's own reasoning, just no longer
// container-scoped. Needs a migration (see project_security_liability_audit_2026_09_25 memory) -
// falls back to the old in-memory-only behavior if the table isn't there yet or the read fails, so
// a missing migration degrades gracefully instead of locking Jesse out of his own admin panel.
async function _getLoginState() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/admin_login_state?id=eq.1&select=failed_attempts,locked_until`, { headers: sbHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  } catch { return null; }
}
async function _setLoginState(patch) {
  try {
    await fetch(`${SB_URL}/rest/v1/admin_login_state?id=eq.1`, {
      method: 'PATCH',
      headers: sbHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(patch)
    });
  } catch (e) { console.error('Failed to persist login rate-limit state:', e); }
}

// Best-effort in-memory fallback, same as before - only relevant now if the Supabase table isn't
// migrated yet, or a read/write to it fails mid-request.
let _failedAttempts = 0;
let _lockedUntil = 0;

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
  const persisted = await _getLoginState();
  const lockedUntilMs = persisted ? Date.parse(persisted.locked_until || 0) || 0 : _lockedUntil;
  if (now < lockedUntilMs) {
    const waitSec = Math.ceil((lockedUntilMs - now) / 1000);
    return { statusCode: 429, body: JSON.stringify({ message: `Too many failed attempts - try again in ${waitSec}s.` }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  if (!pinMatches(body.pin, process.env.ADMIN_PIN)) {
    const currentAttempts = (persisted ? persisted.failed_attempts : _failedAttempts) + 1;
    if (currentAttempts >= LOCKOUT_THRESHOLD) {
      const newLockedUntil = new Date(now + LOCKOUT_MS).toISOString();
      _lockedUntil = now + LOCKOUT_MS;
      _failedAttempts = 0;
      if (persisted !== null) await _setLoginState({ failed_attempts: 0, locked_until: newLockedUntil });
    } else {
      _failedAttempts = currentAttempts;
      if (persisted !== null) await _setLoginState({ failed_attempts: currentAttempts });
    }
    // Small fixed delay to blunt trivial brute-forcing without needing external state.
    await new Promise(r => setTimeout(r, 600));
    return { statusCode: 401, body: JSON.stringify({ message: 'Incorrect PIN' }) };
  }

  _failedAttempts = 0;
  if (persisted !== null) await _setLoginState({ failed_attempts: 0, locked_until: null });
  const token = sign({ exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 });
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  };
};
