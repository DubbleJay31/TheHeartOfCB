const crypto = require('crypto');
const { sbReservations } = require('./_reservations');

function validQuoteToken(body) {
  if (!process.env.LINK_SECRET || !body.qtok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.ci}|${body.co}|${body.prop}|${body.total}|${body.code}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.qtok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

// Mints a capability token for a specific guest+dates, embedded in the booking link
// at signing time. reservations-confirm.js later verifies this token instead of trusting
// a bare POST - closes the "anyone who finds the endpoint can inject a fake reservation" gap
// without requiring a fresh admin PIN entry when Jesse taps the one-click confirm link on his phone.
//
// This alone used to sign whatever guest/email/dates a caller handed it, with no proof any
// of it came from a real quote - so it required a "qtok" (minted admin-side by
// mint-quote-token.js, over guest/email/ci/co/prop/total) proving Jesse actually generated
// this exact quote, before it will mint a signing token at all.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!process.env.LINK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'LINK_SECRET not configured' }) };
  }

  // This is called from the guest's own booking page while they're signing - not an admin
  // session - so it isn't PIN-gated. It only ever signs the exact guest/dates it's given,
  // which the guest already sees on their own booking page.
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { guest, email, ci, co, code } = body;
  if (!guest || !email || !ci || !co || !code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing guest, email, ci, co, or code' }) };
  }
  if (!validQuoteToken(body)) {
    // Logged so a real-world report ("guest couldn't sign") is diagnosable after the fact from
    // Netlify function logs - which of the 7 signed fields actually don't match is otherwise
    // invisible once the guest is just staring at a generic error on their phone.
    console.error('sign-link: invalid qtok for code', code, { guest, email, ci, co, prop: body.prop, total: body.total, hasQtok: !!body.qtok });
    return { statusCode: 401, body: JSON.stringify({ message: 'This booking link has an invalid or outdated signature - ask Jesse to resend it.' }) };
  }

  // The qtok only proves Jesse minted THESE values at some point - not that they're still
  // current. If the quote gets edited after the link is sent (e.g. price corrected in Admin, or
  // dates changed via Change Reservation), the guest's original email still has the old values
  // baked into its URL, still carrying a validly-signed qtok for that stale set, and nothing
  // before this ever re-checked them against what's actually saved now. Block signing on drift in
  // total or dates - the guest just needs a fresh link, which is a lot cheaper than a silent
  // mismatch. Property is deliberately NOT compared here: admin.html embeds the property's long
  // display name (PROPS[x].name, e.g. "Home in The Heart Of CB (Front Home)") in the guest link,
  // while the database's prop_label column holds a differently-formatted label from
  // host-config.json (e.g. "(FRONT) Home in The Heart Of CB") - the two were never meant to be
  // compared, and doing so made every single quote look stale regardless of whether anything had
  // actually changed. If that naming ever gets unified, this can safely compare prop too.
  // Identity verification (Jesse's default policy - see create-identity-session.js) is required
  // before signing unless he's explicitly waived it for this reservation. create-stripe-checkout.js
  // and reservations-confirm.js already enforce this before payment/self-confirm, but this endpoint
  // - the one that actually flips status to 'signed' - never did, so a guest who stripped book.html's
  // .locked class (or POSTed here directly with the values already sitting in their own page) could
  // sign before ever verifying, against the "identity check first, I don't want to hide it" policy.
  // Found in an overnight audit 2026-09-24. Fails closed on a lookup error, same as the other gates.
  try {
    const idResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=id_verify_skip,id_verification_status`);
    const idRows = idResp.ok ? await idResp.json() : [];
    const idOk = idRows.length && (idRows[0].id_verify_skip || idRows[0].id_verification_status === 'verified');
    if (!idOk) {
      return { statusCode: 409, body: JSON.stringify({ message: 'Identity verification must be completed before signing.' }) };
    }
  } catch (e) {
    console.error('Identity verification check failed:', e);
    return { statusCode: 500, body: JSON.stringify({ message: 'Could not verify identity status - please try again.' }) };
  }

  try {
    const curResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=total,check_in,check_out`);
    const cur = curResp.ok ? await curResp.json() : [];
    if (cur.length) {
      const c = cur[0];
      const stale = Math.abs((parseFloat(c.total) || 0) - (parseFloat(body.total) || 0)) > 0.01
        || c.check_in !== ci || c.check_out !== co;
      if (stale) {
        return { statusCode: 409, body: JSON.stringify({ message: 'This quote has been updated since this link was sent - ask Jesse for a current link before signing.' }) };
      }
    }
  } catch (e) { console.error('Freshness check failed:', e); }

  const tok = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${guest}|${email}|${ci}|${co}|${code}`)
    .digest('hex');

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '';

  // Best-effort in the sense that a failed write here never fails the signing flow itself (guest
  // still gets their tok/ip either way) - but it must be awaited: an un-awaited request left
  // running after this handler returns can get silently abandoned when the serverless runtime
  // freezes/tears down the execution context, which is exactly what "sometimes doesn't end up
  // signed" turned out to be. Scoped to status=quoted so a guest re-triggering this (e.g. a page
  // refresh mid-flow) can never step status backward from confirmed/cancelled to signed.
  try {
    await sbReservations(`?code=eq.${encodeURIComponent(code)}&status=eq.quoted`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'signed', signed_name: guest, signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
  } catch (e) { console.error('Failed to mark signed:', e); }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tok, ip })
  };
};
