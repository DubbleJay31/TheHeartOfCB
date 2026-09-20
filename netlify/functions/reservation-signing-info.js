const crypto = require('crypto');
const { sbReservations } = require('./_reservations');

// Public, read-only, keyed by code. book.html's action=confirm page (opened by Jesse to send a
// guest their final confirmation) normally gets the guest's signed name/date/payment method from
// URL params carried in a one-click link built from the guest's own browser at signing time - but
// that link only ever exists for manual payment methods (Venmo/CashApp/etc). For a Stripe payment,
// the webhook confirms server-to-server and Jesse instead reaches this page via admin.html's
// "Send Full Confirmation", built from the reservation's original quote URL, which never carried
// any of that signing state. This fills the gap from the DB columns sign-link.js and
// reservations-confirm.js already persist, and remints the same capability token those two
// functions accept - a deterministic HMAC of values already verified server-side, so handing it
// back here carries no money and only unlocks an already-idempotent confirm.
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const { code } = event.queryStringParameters || {};
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }
  try {
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=guest,email,check_in,check_out,signed_name,signed_at,payment_method`);
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) };
    }
    const row = rows[0];
    let tok = null;
    if (row.signed_at && process.env.LINK_SECRET) {
      tok = crypto.createHmac('sha256', process.env.LINK_SECRET)
        .update(`${row.guest}|${row.email}|${row.check_in}|${row.check_out}|${code}`)
        .digest('hex');
    }
    // signed_ip deliberately excluded - it's not needed by the confirm page (only ever populated
    // in the DB by a PRIOR confirm write, so it's always empty for the exact case this endpoint
    // exists to serve) and there's no reason to hand a guest's IP to anyone who has the code.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_name: row.signed_name || null,
        signed_at: row.signed_at || null,
        payment_method: row.payment_method || null,
        tok
      })
    };
  } catch (e) {
    console.error('reservation-signing-info failed:', e);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) };
  }
};
