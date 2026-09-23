const { escapeHtml } = require('./_reservations');
const { sendPushToAllSubscribers } = require('./_webpush');

// Public, guest-facing - called from app.js (new inquiry submitted) and book.html (guest signed /
// self-reported a manual payment), the same moments those pages already email Jesse. Deliberately
// NOT a generic "send any push you want" endpoint: a public function that accepted freeform
// title/body would let anyone push arbitrary text straight to Jesse's phone. Only a small fixed
// set of notification `type`s is accepted, each with its own server-built title/body template -
// the client supplies just a few short data fields (guest name, property), always truncated and
// escaped before going anywhere near a device.
const TEMPLATES = {
  new_inquiry: (d) => ({
    title: '📩 New Inquiry',
    body: `${d.guest || 'Someone'} · ${d.prop || 'a property'}`
  }),
  signed: (d) => ({
    title: '✍️ Agreement Signed',
    body: `${d.guest || 'A guest'} signed - open the dashboard to verify & confirm`
  }),
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const build = TEMPLATES[body.type];
  if (!build) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Unknown notification type' }) };
  }
  const clean = {
    guest: escapeHtml((body.guest || '').slice(0, 60)),
    prop: escapeHtml((body.prop || '').slice(0, 60))
  };
  const { title, body: notifBody } = build(clean);
  // Fire-and-forget from the caller's perspective - a slow/failed push should never hold up or
  // break the guest's own page (submitting an inquiry, finishing a signature). Not awaited by the
  // guest; this function itself still awaits it so Netlify doesn't tear the process down mid-send.
  const result = await sendPushToAllSubscribers({ title, body: notifBody, url: '/admin.html' });
  // Diagnostic detail included in the response - {ok:true} alone was indistinguishable between
  // "delivered" and "silently found zero subscriptions" or "push service rejected it," which made
  // debugging a "did it actually arrive?" report impossible from the response alone.
  return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
};
