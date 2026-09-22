const { sbReservations } = require('./_reservations');

// Public, read-only, keyed by code - book.html polls this after a guest returns from Stripe's
// hosted identity-verification flow. Verification is asynchronous (Stripe processes the
// document/selfie server-side after the guest is already redirected back), so the redirect itself
// carries no result - this is how the page finds out whether it actually passed. Deliberately
// exposes nothing beyond the one status flag a guest's own browser needs to unlock the payment
// step; no document data, no Stripe session internals.
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const { code } = event.queryStringParameters || {};
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }
  try {
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=id_verify_skip,id_verification_status`);
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_verify_skip: !!rows[0].id_verify_skip,
        id_verification_status: rows[0].id_verification_status || null
      })
    };
  } catch (e) {
    console.error('reservation-verify-status failed:', e);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) };
  }
};
