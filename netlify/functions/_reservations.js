const crypto = require('crypto');
const hostConfig = require('../../host-config.json');

// Shared helpers for the unified reservations table (one row per booking, moving through
// status: inquiry -> quoted -> signed -> confirmed -> cancelled, identified by a stable `code`
// instead of being reconstructed at read time via fuzzy guest/date/URL matching).

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(extra) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...extra };
}

// Raw REST fetch wrapper against the reservations table - path is anything after
// "/rest/v1/reservations", e.g. "?code=eq.HCB-ABC123&select=*".
async function sbReservations(path, options = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/reservations${path}`, {
    ...options,
    headers: sbHeaders(options.headers)
  });
  return r;
}

// Unambiguous 32-symbol alphabet (no 0/O/1/I/L) - meant to be read over the phone or typed
// into a URL by hand, not to carry UUID-scale entropy this app has no use for.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode() {
  let s = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `HCB-${s}`;
}

// Single source of truth for prop1/prop2/prop3 -> display name, replacing four copies of the
// same map that used to live separately in admin.html, reminder.js, quote-followup.js, and
// arrival-reminder.js (the last of which matched on the full display name instead of the short
// key and silently never matched anything).
const PROP_LABELS = {};
for (const [key, p] of Object.entries(hostConfig.properties)) {
  PROP_LABELS[key] = p.label;
}
function propLabel(prop) {
  return PROP_LABELS[prop] || prop || 'Your Stay';
}

module.exports = { SB_URL, SB_KEY, sbHeaders, sbReservations, genCode, PROP_LABELS, propLabel, hostConfig };
