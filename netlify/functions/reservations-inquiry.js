const { sbReservations, genCode, propLabel } = require('./_reservations');

// Public, unauthenticated - this is the guest-facing "Send Booking Request" path on the public
// site. Replaces cloud-sync.js's old inquiry branch: instead of appending to a JSONBin array
// with no identity, this creates the one row that will carry this booking through its whole
// lifecycle (inquiry -> quoted -> signed -> confirmed), identified by `code` from here on.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { first, last, email, phone, prop, ci, co, guests, pets, message, contactPref, rate } = body;
  if (!email || !ci || !first) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing first, email, or ci' }) };
  }
  if (co && co <= ci) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Check-out must be after check-in' }) };
  }
  // The rest of this repo's business rules (guest cap, no past dates, min-night stay) only ever
  // lived in app.js's calendar UI - this public, unauthenticated endpoint never checked any of
  // them itself, so a direct POST (devtools/curl) could store an inquiry that violates all three.
  // Min-night/holiday restrictions are date-specific and pulled live via cloud-sync.js - too much
  // to safely re-derive here without risking blocking a legitimate late-breaking edit - so this
  // only covers the two static, unconditional checks: a known property key, and a check-in date
  // that isn't already in the past. Found in an overnight audit 2026-09-24.
  const PROP_MAX_GUESTS = { prop1: 6, prop2: 2, prop3: 2 };
  if (prop && !PROP_MAX_GUESTS[prop]) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Unrecognized property' }) };
  }
  if (prop && guests && parseInt(guests, 10) > PROP_MAX_GUESTS[prop]) {
    return { statusCode: 400, body: JSON.stringify({ message: `Max ${PROP_MAX_GUESTS[prop]} guests for this property` }) };
  }
  const todayStr = new Date().toISOString().split('T')[0];
  if (ci < todayStr) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Check-in date cannot be in the past' }) };
  }

  try {
    // Guards only against a true accidental double-submit (double-click, a flaky connection
    // retrying the POST) - same email+dates within the last 2 minutes. This used to match on
    // email+check_in with no time bound at all, which was fine for the old model (one JSONBin
    // array entry, loosely deduped) but is wrong here: every genuinely new inquiry needs its own
    // code, even if it happens to share a guest/date with something already on the books - e.g.
    // a repeat guest, or a date that overlaps a reservation that just hasn't been blocked on
    // Airbnb yet. Overlap gets surfaced as a warning (see _detectReservationConflicts in
    // admin.html), never as a silently-dropped inquiry.
    // check_out is included here too - it used to only match on check_in, so a guest who
    // immediately resubmitted to correct a wrong checkout date got matched as a "duplicate" of
    // their own first (wrong-date) submission and the correction was silently dropped.
    const recentCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const coFilter = co ? `check_out=eq.${encodeURIComponent(co)}` : 'check_out=is.null';
    const checkResp = await sbReservations(
      `?email=eq.${encodeURIComponent(email)}&check_in=eq.${encodeURIComponent(ci)}&${coFilter}&created_at=gte.${encodeURIComponent(recentCutoff)}&select=code`
    );
    const existing = checkResp.ok ? await checkResp.json() : [];
    if (existing.length > 0) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code: existing[0].code, skipped: true }) };
    }

    const code = genCode();
    const row = {
      code, status: 'inquiry',
      first_name: first, last_name: last || '', guest: [first, last].filter(Boolean).join(' '),
      email, phone: phone || '',
      prop: prop || '', prop_label: propLabel(prop),
      check_in: ci, check_out: co || null,
      guests_count: guests || '', pets: pets || '', message: message || '',
      contact_pref: contactPref || null,
      // An inquiry has no price yet, but total/nights/tax_occ/tax_sales were NOT NULL columns
      // before tonight's schema change (every prior insert was a fully-priced confirmation) -
      // default them to 0 rather than risk the insert failing if that constraint is still there.
      rate: rate != null ? parseFloat(rate) || 0 : null,
      total: 0, nights: 0, tax_occ: 0, tax_sales: 0
    };

    const r = await sbReservations('', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) {
      const err = await r.text();
      // The check above is a fast-path, not a guarantee - two truly simultaneous submits (see
      // migrations/002_inquiry_dedup_index.sql) can both pass it before either insert commits.
      // The database's own unique index catches that instead, surfaced here as a 23505 violation -
      // treat it the same as the fast-path match above rather than failing the guest's request.
      if (err.includes('reservations_inquiry_dedup_idx') || err.includes('23505')) {
        const retryResp = await sbReservations(
          `?email=eq.${encodeURIComponent(email)}&check_in=eq.${encodeURIComponent(ci)}&${coFilter}&status=eq.inquiry&select=code`
        );
        const retryExisting = retryResp.ok ? await retryResp.json() : [];
        if (retryExisting.length > 0) {
          return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code: retryExisting[0].code, skipped: true }) };
        }
      }
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, code }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
