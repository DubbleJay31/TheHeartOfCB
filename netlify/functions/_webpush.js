const crypto = require('crypto');
const { sbHeaders, SB_URL } = require('./_reservations');

// Hand-rolled Web Push (RFC 8291 message encryption + RFC 8292 VAPID) - no `web-push` npm
// package, matching this repo's zero-npm-dependency pattern for Netlify functions (see
// _stripe.js/_reservations.js, which do the same for Stripe/Supabase via raw fetch()). Jesse chose
// this over adding a dependency, explicitly accepting the tradeoff: more code, more surface area
// for a security-sensitive piece to get subtly wrong. Verified against a real browser push
// subscription (Chrome's FCM endpoint) before ever being wired into a live trigger - see
// project_admin_pwa_push_2026_09_23 memory for how.

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlToBuf = (s) => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
};

let _vapidPrivateKeyObj = null;
function _vapidPrivateKey() {
  if (_vapidPrivateKeyObj) return _vapidPrivateKeyObj;
  const der = b64urlToBuf(process.env.VAPID_PRIVATE_KEY);
  _vapidPrivateKeyObj = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  return _vapidPrivateKeyObj;
}

// RFC 8292 - a short-lived ES256 JWT proving these requests come from the site that owns
// VAPID_PUBLIC_KEY, plus that same public key so the push service can verify it. `aud` must be
// just the scheme+host of the push endpoint (not the full path) per spec.
function _vapidHeader(endpoint) {
  const aud = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:stay@theheartofcb.com' };
  const signingInput = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(claims));
  // dsaEncoding:'ieee-p1363' -> raw r||s (64 bytes), what a JWT ES256 signature needs - Node's
  // default DER encoding would be wrong here and silently fail verification on the push service
  // side with no useful error back.
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key: _vapidPrivateKey(), dsaEncoding: 'ieee-p1363' });
  const jwt = signingInput + '.' + b64url(sig);
  return `vapid t=${jwt}, k=${process.env.VAPID_PUBLIC_KEY}`;
}

// RFC 8291 - encrypts `payload` (a JS object, JSON-stringified) for one subscription's p256dh/auth
// keys, returning the single aes128gcm-encoded binary body a push service accepts as-is.
function _encryptPayload(payload, subscription) {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const uaPublic = b64urlToBuf(subscription.p256dh);   // subscriber's ECDH public key, 65 bytes
  const authSecret = b64urlToBuf(subscription.auth);   // subscriber's 16-byte auth secret

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();                // this message's own ephemeral public key
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const salt = crypto.randomBytes(16);

  // ikm = HKDF(auth_secret, sharedSecret, "WebPush: info\0" + uaPublic + asPublic, 32)
  const prkKey = crypto.createHmac('sha256', authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic]);
  const ikm = crypto.createHmac('sha256', prkKey).update(Buffer.concat([keyInfo, Buffer.from([1])])).digest();

  // CEK/nonce = HKDF(salt, ikm, "Content-Encoding: <x>\0", 16/12)
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
  const cek = crypto.createHmac('sha256', prk).update(Buffer.concat([cekInfo, Buffer.from([1])])).digest().subarray(0, 16);
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
  const nonce = crypto.createHmac('sha256', prk).update(Buffer.concat([nonceInfo, Buffer.from([1])])).digest().subarray(0, 12);

  // Single record (payload always small here) - RFC 8188 delimiter 0x02 marks "last record."
  const recordPlaintext = Buffer.concat([plaintext, Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(recordPlaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSizeBuf = Buffer.alloc(4);
  recordSizeBuf.writeUInt32BE(ciphertext.length, 0);
  const header = Buffer.concat([salt, recordSizeBuf, Buffer.from([asPublic.length]), asPublic]);
  return Buffer.concat([header, ciphertext]);
}

// Sends one push message to one subscription. Returns {ok, status, gone} - `gone` (404/410) means
// the push service has permanently discarded this subscription (uninstalled, unsubscribed,
// endpoint expired) and the row should be deleted, not retried.
async function sendWebPush(subscription, payload) {
  const body = _encryptPayload(payload, subscription);
  const resp = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Urgency': 'high',
      'Authorization': _vapidHeader(subscription.endpoint)
    },
    body
  });
  return { ok: resp.ok, status: resp.status, gone: resp.status === 404 || resp.status === 410 };
}

// Sends to every stored subscription (Jesse may have more than one device), pruning any the push
// service reports as gone. Never throws - a broken push send should never block or fail the email
// notification it rides alongside.
async function sendPushToAllSubscribers(payload) {
  try {
    const listResp = await fetch(`${SB_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth`, { headers: sbHeaders() });
    if (!listResp.ok) return;
    const subs = await listResp.json();
    await Promise.all(subs.map(async (s) => {
      try {
        const { gone } = await sendWebPush(s, payload);
        if (gone) {
          await fetch(`${SB_URL}/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: 'DELETE', headers: sbHeaders() }).catch(() => {});
        }
      } catch (e) { console.error('Push send failed for subscription', s.id, e); }
    }));
  } catch (e) { console.error('sendPushToAllSubscribers failed:', e); }
}

module.exports = { sendWebPush, sendPushToAllSubscribers };
