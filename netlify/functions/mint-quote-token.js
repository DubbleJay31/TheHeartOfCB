const crypto = require('crypto');
const { requireAdmin } = require('./_auth');

// Mints a signature over a quote's core terms (who/when/where/how much) while Jesse is
// building it in the admin dashboard. book.html carries this "qtok" in the booking link it
// sends the guest, and sign-link.js refuses to mint a signing capability token unless this
// signature checks out - closing the gap where sign-link.js used to hand out a valid token
// for ANY guest/email/dates a caller made up, with no proof it came from a real quote Jesse
// generated. Reuses LINK_SECRET (same secret sign-link.js already uses) rather than adding
// a new env var.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }
  if (!process.env.LINK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'LINK_SECRET not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { guest, email, ci, co, prop, total, code } = body;
  if (!guest || !email || !ci || !co || !prop || !total || !code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing guest, email, ci, co, prop, total, or code' }) };
  }

  const qtok = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${guest}|${email}|${ci}|${co}|${prop}|${total}|${code}`)
    .digest('hex');

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qtok }) };
};
