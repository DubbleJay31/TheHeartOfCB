const crypto = require('crypto');
const { requireAdmin } = require('./_auth');

function validCapabilityToken(body) {
  if (!process.env.LINK_SECRET || !body.tok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.check_in}|${body.check_out}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.tok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { guest, email, prop, check_in, check_out, nights, total, rate, tax_occ, tax_sales, signed_ip, notes } = body;
  if (!guest || !check_in || !check_out) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing guest, check_in, or check_out' }) };
  }

  // Two valid ways in: a logged-in admin session (used by the manual "Confirm" button on a
  // quote), or a per-booking capability token minted by sign-link.js at signing time (used by
  // the one-click confirm link in the "Payment Sent" email, which isn't an admin session).
  if (!requireAdmin(event) && !validCapabilityToken(body)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

  try {
    const checkUrl = `${SB_URL}/rest/v1/reservations?email=eq.${encodeURIComponent(email || '')}&check_in=eq.${encodeURIComponent(check_in)}&select=id`;
    const checkResp = await fetch(checkUrl, { headers: SB_H });
    const existing = checkResp.ok ? await checkResp.json() : [];
    if (existing.length > 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const r = await fetch(`${SB_URL}/rest/v1/reservations`, {
      method: 'POST',
      headers: { ...SB_H, Prefer: 'return=minimal' },
      body: JSON.stringify({
        guest, email: email || '', prop, check_in, check_out, nights,
        total: parseFloat(total) || 0,
        rate: rate != null ? parseFloat(rate) || 0 : null,
        tax_occ: tax_occ != null ? parseFloat(tax_occ) || 0 : null,
        tax_sales: tax_sales != null ? parseFloat(tax_sales) || 0 : null,
        signed_ip: signed_ip || null,
        notes: notes || ''
      })
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
