const crypto = require('crypto');
const { sbReservations } = require('./_reservations');

// Public - this is called by Stripe's own servers, not a browser, so it can't be PIN-gated or
// capability-token-gated like everything else. Authenticity instead comes entirely from the
// Stripe-Signature header, an HMAC over the raw request body using a secret only Stripe and this
// function know (STRIPE_WEBHOOK_SECRET, from the webhook's setup page in the Stripe dashboard -
// separate from STRIPE_SECRET_KEY). This is what makes payment confirmation reliable: it doesn't
// depend on the guest's browser staying open, a redirect completing, or Jesse checking his bank -
// Stripe tells this function directly, server to server, the moment a charge actually succeeds.
function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = {};
  sigHeader.split(',').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) parts[p.slice(0, i)] = p.slice(i + 1);
  });
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  // Reject anything older than 5 minutes - basic replay protection, matching Stripe's own
  // documented recommendation for webhook verification.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  let gotBuf;
  try { gotBuf = Buffer.from(v1, 'hex'); } catch { return false; }
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

async function _notifyJesseReservation(row, amount) {
  try {
    const code = row.code;
    const guest = row.guest || 'Guest';
    const adminUrl = 'https://theheartofcb.com/admin.html#code=' + encodeURIComponent(code);
    const fmtD = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; } };
    const prefLabel = row.contact_pref === 'text' ? '💬 Text' : row.contact_pref === 'email' ? '📧 Email' : row.contact_pref === 'either' ? '📧💬 Either' : null;
    const html = `<div style="font-family:Georgia,serif;padding:20px;max-width:480px;">
      <p style="font-size:16px;"><strong>💳 Stripe payment received - ${guest}</strong></p>
      <p>$${amount.toFixed(2)} charged successfully. This reservation has been automatically marked <strong>confirmed</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0;">
        <tr><td style="padding:4px 0;color:#666;width:110px;">Dates</td><td style="padding:4px 0;font-weight:600;">${fmtD(row.check_in)} → ${fmtD(row.check_out)}</td></tr>
        ${prefLabel ? `<tr><td style="padding:4px 0;color:#666;">Prefers</td><td style="padding:4px 0;font-weight:700;">${prefLabel}</td></tr>` : ''}
      </table>
      <div style="margin-top:10px;padding:12px;background:#fef3c7;border-radius:6px;font-size:13px;color:#92400e;">
        📧 Send the guest's confirmation via their preferred method, and 📅 block these dates on your Airbnb calendar so they don't get double-booked.
      </div>
      <p style="margin-top:14px;"><a href="${adminUrl}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;">Open in Admin & Send Confirmation</a></p>
    </div>`;
    await fetch('https://theheartofcb.com/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://theheartofcb.com' },
      body: JSON.stringify({ to: ['jessejonesrealestate@gmail.com'], subject: `Stripe payment received - ${guest}`, html })
    });
  } catch (e) { console.error('Jesse notification failed:', e); }
}

// A physical order needs Jesse to actually see it to ship it - there's no admin dashboard for
// merch the way there is for reservations, so this notification email IS the fulfillment queue.
async function _notifyJesseMerchOrder(session) {
  try {
    const product = session.metadata?.product || 'item';
    const qty = session.metadata?.qty || '1';
    const amount = session.amount_total != null ? (session.amount_total / 100).toFixed(2) : '?';
    const email = session.customer_details?.email || '(no email)';
    const shipName = session.shipping_details?.name || session.customer_details?.name || '(no name)';
    const addr = session.shipping_details?.address || {};
    const addrLines = [addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '), addr.country]
      .filter(Boolean).join('<br>');
    const html = `<div style="font-family:Georgia,serif;padding:20px;">
      <p style="font-size:16px;"><strong>📦 New merch order - ${product} × ${qty}</strong></p>
      <p>$${amount} charged successfully.</p>
      <p><strong>Ship to:</strong><br>${shipName}<br>${addrLines || '(no shipping address on file)'}</p>
      <p><strong>Contact:</strong> ${email}</p>
    </div>`;
    await fetch('https://theheartofcb.com/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://theheartofcb.com' },
      body: JSON.stringify({ to: ['jessejonesrealestate@gmail.com'], subject: `New merch order - ${product} × ${qty}`, html })
    });
  } catch (e) { console.error('Merch order notification failed:', e); }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return { statusCode: 500, body: 'Not configured' };
  }

  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifyStripeSignature(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  if (stripeEvent.type !== 'checkout.session.completed') {
    // Not an event this function cares about - acknowledge so Stripe doesn't retry it forever.
    return { statusCode: 200, body: 'ok' };
  }

  const session = stripeEvent.data?.object || {};
  const code = session.metadata?.code;
  const guest = session.metadata?.guest || 'Guest';

  // Merch orders and reservation payments both land on this one endpoint (one Stripe account,
  // one webhook) - metadata.product vs metadata.code is how create-merch-checkout.js and
  // create-stripe-checkout.js each mark which kind of session they minted.
  if (session.metadata?.product) {
    await _notifyJesseMerchOrder(session);
    return { statusCode: 200, body: 'ok' };
  }

  if (!code) {
    console.error('checkout.session.completed with no code or product in metadata:', session.id);
    return { statusCode: 200, body: 'ok' };
  }

  try {
    const resp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,total,host_notes,check_in,check_out,contact_pref`);
    const rows = resp.ok ? await resp.json() : [];
    if (!rows.length) {
      console.error('Stripe webhook: no reservation found for code', code);
      return { statusCode: 200, body: 'ok' };
    }
    // Idempotent - Stripe can and does redeliver webhook events. Already-confirmed just
    // acknowledges without writing again.
    if (rows[0].status === 'confirmed') {
      return { statusCode: 200, body: 'ok' };
    }

    const amount = (session.amount_total != null ? session.amount_total / 100 : parseFloat(rows[0].total) || 0);
    const paidNote = `Paid via Stripe (session ${session.id})`;
    const hostNotes = rows[0].host_notes ? `${rows[0].host_notes}\n\n${paidNote}` : paidNote;
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
        host_notes: hostNotes
      })
    });
    if (!r.ok) {
      console.error('Stripe webhook: failed to confirm reservation', code, await r.text());
      return { statusCode: 500, body: 'DB write failed' };
    }

    await _notifyJesseReservation({ code, guest, check_in: rows[0].check_in, check_out: rows[0].check_out, contact_pref: rows[0].contact_pref }, amount);
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('Stripe webhook handler error:', e);
    return { statusCode: 500, body: String(e) };
  }
};
