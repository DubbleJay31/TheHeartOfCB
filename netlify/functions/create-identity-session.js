const { sbReservations } = require('./_reservations');
const { stripeFetch } = require('./_stripe');

// Public, guest-facing - called from book.html BEFORE a guest signs (Jesse: "i want identity
// check first before signing"). Mirrors create-stripe-checkout.js's shape (session created on
// demand, eligibility always read from the reservation's own current row, never trusted from the
// request body) but for a Stripe Identity VerificationSession instead of a Checkout Session. Uses
// Stripe's hosted redirect flow (the `url` on the created session), not the embedded/client-secret
// flow - this repo has no Stripe.js loaded anywhere and no npm dependencies (see _stripe.js), and
// the hosted redirect needs neither.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, return_url } = body;
  if (!code || !return_url) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code or return_url' }) };
  }

  try {
    const resp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,id_verify_skip,id_verification_status,id_verify_session_id`);
    const rows = resp.ok ? await resp.json() : [];
    if (!rows.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No reservation found for that code' }) };
    }
    const r = rows[0];

    if (r.id_verify_skip) {
      return { statusCode: 409, body: JSON.stringify({ message: 'ID verification was waived by the host for this reservation - nothing to do here.' }) };
    }
    if (r.id_verification_status === 'verified') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ already_verified: true }) };
    }
    // Verification now runs BEFORE signing, so this only needs to reject a reservation that's
    // already fully done (confirmed) or dead (cancelled) - inquiry/quoted/signed are all fair
    // game, since a guest can reach this from the very first time they open their quote link.
    if (r.status === 'confirmed' || r.status === 'cancelled') {
      return { statusCode: 409, body: JSON.stringify({ message: 'This reservation is no longer open for identity verification.' }) };
    }

    // A guest re-loading the page mid-flow (or retrying after an abandoned attempt) shouldn't
    // spin up a fresh $1.50 session every time - reuse whatever's already open if Stripe still
    // considers it usable, only minting a new one when there isn't one or it's terminally done.
    if (r.id_verify_session_id) {
      const existing = await stripeFetch(`/identity/verification_sessions/${r.id_verify_session_id}`, null, 'GET');
      if (existing.ok && (existing.json.status === 'requires_input' || existing.json.status === 'processing') && existing.json.url) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: existing.json.url }) };
      }
    }

    const { ok, json } = await stripeFetch('/identity/verification_sessions', {
      type: 'document',
      return_url,
      options: { document: { require_matching_selfie: true } },
      metadata: { code }
    });

    if (!ok || !json.url) {
      console.error('Stripe Identity session creation failed:', json);
      return { statusCode: 500, body: JSON.stringify({ message: json.error?.message || 'Could not start identity verification' }) };
    }

    await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id_verify_session_id: json.id,
        id_verification_status: 'pending',
        updated_at: new Date().toISOString()
      })
    }).catch(e => console.error('Failed to record identity session id:', e));

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: json.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
