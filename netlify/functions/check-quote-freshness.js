const { sbReservations } = require('./_reservations');

// Public, read-only. book.html calls this on page load so a guest sees immediately if the price
// in their link has gone stale (Jesse edited the quote after sending it), instead of only finding
// out if they get all the way to signing - sign-link.js's freshness check blocks the actual
// signing action, but the page itself used to just display the old numbers with no indication
// anything had changed. This is purely informational (returns fresh/stale, nothing else) and
// changes nothing server-side.
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const { code, total } = event.queryStringParameters || {};
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  try {
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,total`);
    const rows = r.ok ? await r.json() : [];
    if (!rows.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: false, reason: 'not_found' }) };
    }
    const row = rows[0];
    if (row.status === 'cancelled') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: false, reason: 'cancelled' }) };
    }
    // A guest re-clicking their ORIGINAL emailed link (not the signed=1 receipt link, which
    // stays valid on purpose) after already finishing everything used to just show the full
    // sign-and-pay form again, as if nothing had happened yet - confusing, and a stale re-signature
    // attempt against an already-confirmed reservation.
    if (row.status === 'confirmed') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: false, reason: 'already_confirmed', status: 'confirmed' }) };
    }
    const fresh = Math.abs((parseFloat(row.total) || 0) - (parseFloat(total) || 0)) < 0.01;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fresh, reason: fresh ? null : 'price_changed', status: row.status })
    };
  } catch (e) {
    // A failed check should never block a guest from viewing/paying a legitimately fresh quote -
    // fail open (assume fresh) rather than false-flagging every guest during a transient outage.
    console.error('Freshness check failed:', e);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fresh: true }) };
  }
};
