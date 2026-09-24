const { sbReservations, hostConfig } = require('./_reservations');

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
  // Same check ical-export.js already does for the same reason - was previously just checking
  // truthiness, so a typo'd or garbled prop value (a display label instead of the short key, a
  // stray "prop9") silently returned an empty busy-dates list instead of a clear 400, which just
  // reads as "nothing booked" rather than surfacing the actual mistake.
  if (!prop || !hostConfig.properties[prop]) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing or unknown prop' }) };
  }
  try {
    // Also includes a change-pending row (status reset to quoted/signed by an in-progress Change
    // Reservation edit on what's still a real, already-paying guest - same signal
    // renderConfirmedPanel's isChangePending uses in admin.html) - status=eq.confirmed alone
    // let an already-booked guest's dates show available to a brand-new visitor for as long as
    // their edit sat unresolved. payment_method (never touched by the edit itself) is still the
    // only field that tells the two apart; check_in/check_out are the only fields ever returned.
    const r = await sbReservations(
      `?prop=eq.${encodeURIComponent(prop)}&select=status,payment_method,check_in,check_out`
    );
    if (!r.ok) {
      return { statusCode: 500, body: JSON.stringify({ message: await r.text() }) };
    }
    const rows = await r.json();
    const busy = rows.filter(x =>
      x.check_in && x.check_out &&
      (x.status === 'confirmed' || ((x.status === 'quoted' || x.status === 'signed') && x.payment_method))
    ).map(x => ({ check_in: x.check_in, check_out: x.check_out }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify(busy)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
