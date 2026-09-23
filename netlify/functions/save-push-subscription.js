const { requireAdmin } = require('./_auth');
const { sbHeaders, SB_URL } = require('./_reservations');

// Admin-authenticated - only Jesse's own logged-in admin session can register a device to receive
// push notifications, never a public/guest-facing endpoint. Upserts on endpoint (a device
// resubscribing, e.g. after clearing site data, gets a fresh endpoint URL and just adds a new row
// - the old one gets pruned automatically by _webpush.js the next time a push to it 404s/410s).
exports.handler = async function(event) {
  if (event.httpMethod === 'DELETE') {
    if (!requireAdmin(event)) return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
    if (!body.endpoint) return { statusCode: 400, body: JSON.stringify({ message: 'Missing endpoint' }) };
    await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}`, {
      method: 'DELETE', headers: sbHeaders()
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing or malformed subscription' }) };
  }

  try {
    const resp = await fetch(`${SB_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        device_label: (body.deviceLabel || '').slice(0, 120),
        created_at: new Date().toISOString()
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Failed to save push subscription:', errText);
      return { statusCode: 500, body: JSON.stringify({ message: 'Could not save subscription' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
