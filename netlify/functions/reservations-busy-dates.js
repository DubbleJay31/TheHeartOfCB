const { sbReservations } = require('./_reservations');

// Public, read-only, unauthenticated - a second source for the guest-facing availability
// calendar (app.js), alongside Airbnb's iCal feed. A guest who signs and pays through book.html
// is marked `confirmed` here instantly, but Airbnb's calendar has no idea until either Jesse
// manually blocks those dates there or Airbnb polls ical-export.js's own feed on its own
// schedule (hours-scale delay) - without this, the site's OWN calendar would have to wait on
// that same round trip just to reflect its OWN booking, even though it already knows about it
// immediately. Exposes only check_in/check_out - no guest name, email, or price, same privacy
// level as the iCal feed this supplements.
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
