// Shared Stripe REST helper. This repo has no npm dependencies anywhere (no package.json) and
// every other integration (Supabase, Resend) talks to its REST API with plain fetch rather than
// an SDK - Stripe's REST API is well-documented and doesn't need its SDK either, so this keeps
// the same zero-dependency style instead of introducing npm tooling for the first time.

const STRIPE_API = 'https://api.stripe.com/v1';

// Stripe's REST API takes classic form-urlencoded bodies, including bracket notation for nested
// objects/arrays (e.g. line_items[0][price_data][unit_amount]=1234). Flattens a plain JS object
// into that format so callers can just build a normal nested object.
function _flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') _flatten(item, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (typeof v === 'object') {
      _flatten(v, key, out);
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
}

function toFormBody(obj) {
  const out = [];
  _flatten(obj, '', out);
  return out.join('&');
}

// path e.g. "/checkout/sessions". method defaults to POST since that's nearly everything this app
// calls Stripe for.
async function stripeFetch(path, body, method) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const opts = {
    method: method || 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (body) opts.body = toFormBody(body);
  const r = await fetch(`${STRIPE_API}${path}`, opts);
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json };
}

module.exports = { stripeFetch, toFormBody };
