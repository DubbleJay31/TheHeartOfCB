const { sbReservations } = require('./_reservations');

// Public, read-only, unauthenticated - the guest-facing availability calendar (app.js) only ever
// checked Airbnb's iCal feed for what's booked, never this site's own reservations table. A guest
// who signs and pays through book.html gets marked `confirmed` here immediately, but Airbnb's
// calendar has no idea until Jesse manually blocks those dates there - a real double-booking
// window between a direct booking landing and that manual step happening. This closes the gap by
// letting app.js merge confirmed-reservation date ranges in with the iCal ranges it already uses.
// Exposes only check_in/check_out - no guest name, email, or price - the same privacy level as the
// iCal feed this supplements.
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const prop = (event.queryStringParameters || {}).prop;
  if (!prop) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing prop' }) };
  }
  try {
    const r = await sbReservations(
      `?prop=eq.${encodeURIComponent(prop)}&status=eq.confirmed&select=check_in,check_out`
    );
    if (!r.ok) {
      return { statusCode: 500, body: JSON.stringify({ message: await r.text() }) };
    }
    const rows = await r.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify(rows.filter(x => x.check_in && x.check_out))
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
