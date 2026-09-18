const { requireAdmin } = require('./_auth');

// Proxies all JSONBin.io reads/writes server-side, using JSONBIN_KEY/JSONBIN_BIN env vars
// (already configured — quote-followup.js has used them the same way).
// Before this, the master key lived directly in admin.html and app.js, which every site
// visitor's browser downloads — anyone could read it from view-source and get full
// read/write access to every synced quote and inquiry (guest names, emails, phone numbers).
//
// Access rules:
//  - GET  ?scope=pricing  -> public, no auth. Only returns the pricing object (used by the
//    public price estimator on every page load) - never guest data.
//  - GET  (no scope)      -> admin session required. Returns the full bin (quotes/inquiries/pricing).
//  - POST { inquiry }     -> public, no auth. Appends exactly one inquiry server-side and
//    returns nothing back - this is the public "Send Booking Request" path.
//  - PUT  <full body>     -> admin session required. Overwrites the full bin.

async function _jbinRead(key, bin) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${bin}/latest`, {
    headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) return { quotes: [], inquiries: [], pricing: null };
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
    const scope = (event.queryStringParameters || {}).scope;
    if (scope === 'pricing') {
      const data = await _jbinRead(key, bin);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pricing: data.pricing || null }) };
    }
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    }
    const data = await _jbinRead(key, bin);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    const inquiry = body.inquiry;
    if (!inquiry || !inquiry.email || !inquiry.ci) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing inquiry' }) };
    }
    const data = await _jbinRead(key, bin);
    const inquiries = data.inquiries || [];
    const isDup = inquiries.some(e => e.email === inquiry.email && e.ci === inquiry.ci);
    if (!isDup) {
      inquiries.unshift(inquiry);
      await _jbinWrite(key, bin, { quotes: data.quotes || [], inquiries: inquiries.slice(0, 50), pricing: data.pricing });
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod === 'PUT') {
    if (!requireAdmin(event)) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    await _jbinWrite(key, bin, body);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
