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

async function _jbinRead(key, bin) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}/latest`, {
    headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) return { pricing: null };
  return await r.json();
}

async function _jbinWrite(key, bin, data) {
  return fetch(`https://api.jsonbin.io/v3/b/${bin}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
    body: JSON.stringify(data)
  });
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
    await _jbinWrite(key, bin, { pricing: body.pricing || null });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
