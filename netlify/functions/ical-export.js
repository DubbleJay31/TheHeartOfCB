const { sbReservations, hostConfig } = require('./_reservations');

// Public, read-only. Serves this property's confirmed reservations as a standard iCalendar feed -
// meant to be added under Airbnb's own "Sync calendars > Import calendar" setting for each
// listing, so a reservation made directly through this site (regardless of how it was paid) gets
// blocked on Airbnb automatically on Airbnb's own sync schedule, instead of relying on Jesse to
// remember to block it by hand. This is the one-directional opposite of app.js's calendar, which
// only ever reads FROM Airbnb's feed - this endpoint is what this site publishes TO Airbnb.
//
// Deliberately minimal: no guest names, emails, or any other PII - just blocked date ranges. The
// URL isn't secret (same posture as every other public read endpoint here, e.g.
// check-quote-freshness.js), but there's nothing sensitive in the response even so.
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const prop = (event.queryStringParameters || {}).prop;
  if (!prop || !hostConfig.properties[prop]) {
    return { statusCode: 400, body: 'Missing or unknown prop' };
  }

  try {
    const r = await sbReservations(`?prop=eq.${encodeURIComponent(prop)}&status=eq.confirmed&select=code,check_in,check_out`);
    const rows = r.ok ? await r.json() : [];

    // All-day events use bare YYYYMMDD (VALUE=DATE, no time/timezone) - matches the format
    // Airbnb's own exported feeds use, and what _parseICS() in app.js already expects when
    // reading Airbnb's feed the other direction.
    const asIcsDate = s => (s || '').replace(/-/g, '');
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const events = rows
      .filter(row => row.check_in && row.check_out)
      .map(row => [
        'BEGIN:VEVENT',
        `UID:${row.code}@theheartofcb.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${asIcsDate(row.check_in)}`,
        `DTEND;VALUE=DATE:${asIcsDate(row.check_out)}`,
        `SUMMARY:Reserved`,
        'END:VEVENT'
      ].join('\r\n'))
      .join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${hostConfig.business.name}//Reservations//EN`,
      'CALSCALE:GREGORIAN',
      events,
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${prop}.ics"`,
        'Cache-Control': 'public, max-age=1800'
      },
      body: ics
    };
  } catch (e) {
    console.error('ical-export failed:', e);
    return { statusCode: 500, body: 'Failed to build calendar feed' };
  }
};
