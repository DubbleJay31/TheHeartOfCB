const { stripeFetch } = require('./_stripe');

// Public. The product catalog lives here, server-side - the client only ever sends a product
// KEY, never a price, so a tampered request can't talk this down to a cheaper charge (the same
// reasoning create-stripe-checkout.js already applies to reservation totals). Add new products
// here as the shop grows.
const CATALOG = {
  mug: { name: 'THOCB Coffee Mug', price: 1299 }
};

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { product, success_url, cancel_url } = body;
  const qty = Math.max(1, Math.min(10, parseInt(body.qty, 10) || 1));
  const item = CATALOG[product];
  if (!item || !success_url || !cancel_url) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid product or missing redirect URLs' }) };
  }

  try {
    const { ok, json } = await stripeFetch('/checkout/sessions', {
      mode: 'payment',
      success_url,
      cancel_url,
      // A physical product needs an address to actually ship to - Stripe Checkout collects
      // this as part of its own hosted form when this is set.
      shipping_address_collection: { allowed_countries: ['US'] },
      line_items: [{
        quantity: qty,
        price_data: {
          currency: 'usd',
          unit_amount: item.price,
          product_data: { name: item.name }
        }
      }],
      metadata: { product, qty: String(qty) }
    });
    if (!ok || !json.url) {
      console.error('Merch checkout session failed:', json);
      return { statusCode: 500, body: JSON.stringify({ message: json.error?.message || 'Could not start checkout' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: json.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
