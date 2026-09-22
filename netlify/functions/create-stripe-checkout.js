const { sbReservations, propLabel } = require('./_reservations');
const { stripeFetch } = require('./_stripe');

// Public, guest-facing - called from book.html the moment a guest clicks "Pay Now" on the Credit
// Card option, which only becomes clickable after they've signed (same _agreementSent gate every
// other payment method already goes through). Creates a fresh Stripe Checkout Session on demand
// rather than a pre-minted link embedded in the URL at quote-generation time - a session created
// this way can never go stale (no expiry-before-use risk), and the charge amount is always read
// straight from the reservation's own current row (rate/tax_occ/tax_sales/credit -> total), never
// trusted from the request body, the same pattern reservations-confirm.js already uses.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, guest, email, check_in, check_out, success_url, cancel_url } = body;
  if (!code || !guest || !email || !check_in || !check_out || !success_url || !cancel_url) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) };
  }

  try {
    const resp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=*`);
    const rows = resp.ok ? await resp.json() : [];
    if (!rows.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No reservation found for that code' }) };
    }
    const r = rows[0];

    // Must already be signed (not just requested, not already confirmed/cancelled) - the same
    // "sign before you can pay" rule the rest of book.html enforces, checked again server-side
    // here since this is the one payment path Stripe fully automates end to end.
    if (r.status !== 'signed') {
      return { statusCode: 409, body: JSON.stringify({ message: 'This reservation must be signed before payment can be collected.' }) };
    }
    // ID verification (Jesse's default policy - see create-identity-session.js) is required
    // before payment unless he's explicitly waived it for this reservation. Checked server-side,
    // not just hidden client-side in book.html, since this is the endpoint that actually starts
    // moving money.
    if (!r.id_verify_skip && r.id_verification_status !== 'verified') {
      return { statusCode: 409, body: JSON.stringify({ message: 'Identity verification must be completed before payment.' }) };
    }
    if (r.guest !== guest || r.email !== email || r.check_in !== check_in || r.check_out !== check_out) {
      return { statusCode: 409, body: JSON.stringify({ message: 'This link no longer matches the current reservation - ask Jesse for a fresh link.' }) };
    }

    const amountCents = Math.round((parseFloat(r.total) || 0) * 100);
    if (amountCents <= 0) {
      return { statusCode: 400, body: JSON.stringify({ message: 'No amount due on this reservation' }) };
    }

    const nights = r.nights || Math.round((new Date(check_out) - new Date(check_in)) / 86400000);
    const { ok, json } = await stripeFetch('/checkout/sessions', {
      mode: 'payment',
      success_url,
      cancel_url,
      customer_email: email,
      client_reference_id: code,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: `${propLabel(r.prop)} - ${check_in} to ${check_out} (${nights} night${nights !== 1 ? 's' : ''})`
          }
        }
      }],
      metadata: { code, guest, email }
    });

    if (!ok || !json.url) {
      console.error('Stripe session creation failed:', json);
      return { statusCode: 500, body: JSON.stringify({ message: json.error?.message || 'Could not start checkout' }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: json.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
