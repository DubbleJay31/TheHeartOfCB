const { requireAdmin } = require('./_auth');

// Proxies pricing reads/writes server-side via JSONBin.io, using JSONBIN_KEY/JSONBIN_BIN env
// vars. Quotes and inquiries used to live in this same bin too, but they've moved to the
// reservations table (one row per booking, identified by a `code`, moving through a real
// status) - this function is now pricing-only.
//
// Access rules:
//  - GET ?scope=pricing -> public, no auth. Used by the public price estimator on every page
//    load.
//  - GET  (no scope)     -> admin session required. Returns the pricing object.
//  - PUT  { pricing }    -> admin session required. Overwrites the stored pricing object.

// Jesse: pricing autosave was intermittently 504ing, and separately reporting "saved" even when
// it hadn't. Two compounding causes, both fixed here and in admin.html's _cloudWrite():
// 1. Neither JSONBin call had a timeout - a slow JSONBin response (this is their free tier,
//    latency is real and not something this code controls) meant the fetch just hung until
//    Netlify's own platform-level function timeout (~10s) killed it, producing an opaque 504
//    with no useful message. An explicit, shorter timeout here means a slow JSONBin now fails
//    fast with a clear error this function actually controls, instead of a mystery gateway timeout.
// 2. _jbinWrite()'s response was never checked - a failed write (whether from the JSONBin service
//    itself, a bad key, or the timeout above) was silently treated as success by the caller below,
//    which then told the client {ok:true} regardless. Now checked and surfaced.
const JBIN_TIMEOUT_MS = 8000;

async function _jbinRead(key, bin) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JBIN_TIMEOUT_MS);
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}/latest`, {
      headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' },
      signal: controller.signal
    });
    if (!r.ok) return { pricing: null, _error: `JSONBin read failed: ${r.status}` };
    return await r.json();
  } catch (e) {
    return { pricing: null, _error: e.name === 'AbortError' ? 'JSONBin read timed out' : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function _jbinWrite(key, bin, data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JBIN_TIMEOUT_MS);
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'JSONBin write timed out' : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function(event) {
  const key = process.env.JSONBIN_KEY;
  const bin = process.env.JSONBIN_BIN;
  if (!key || !bin) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Cloud sync not configured' }) };
  }

  if (event.httpMethod === 'GET') {
    const data = await _jbinRead(key, bin);
    if ((event.queryStringParameters || {}).scope === 'pricing') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricing: data.pricing || null }) };
    }
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricing: data.pricing || null }) };
  }

  if (event.httpMethod === 'PUT') {
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const result = await _jbinWrite(key, bin, { pricing: body.pricing || null });
    if (!result.ok) {
      console.error('cloud-sync PUT failed:', result);
      return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, message: result.error || `JSONBin write failed: ${result.status}` }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
