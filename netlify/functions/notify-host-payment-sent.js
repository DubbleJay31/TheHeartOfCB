const crypto = require('crypto');
const { sbReservations, escapeHtml } = require('./_reservations');

// Same capability-token scheme sign-link.js mints and reservations-report-payment.js already
// checks - proves the caller is legitimately THIS guest's own signed-in browser session (so
// random callers can't spam Jesse's inbox), not that any money moved.
function validGuestToken(body) {
  if (!process.env.LINK_SECRET || !body.tok) return false;
  const expected = crypto.createHmac('sha256', process.env.LINK_SECRET)
    .update(`${body.guest}|${body.email}|${body.check_in}|${body.check_out}|${body.code}`)
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');
  const gotBuf = Buffer.from(String(body.tok), 'hex');
  return expBuf.length === gotBuf.length && crypto.timingSafeEqual(expBuf, gotBuf);
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY || !process.env.LINK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code, guest, email, check_in, check_out, method } = body;
  if (!code || !guest || !email || !check_in || !check_out || !method) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) };
  }
  if (!validGuestToken(body)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Invalid or missing capability token' }) };
  }

  try {
    // Re-read the reservation's own trusted data server-side rather than trusting anything else
    // the guest's body might have sent for the email's content - the email is informational, but
    // there's no reason to trust guest-supplied figures here when the real row already has them.
    const resp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=guest,email,phone,check_in,check_out,nights,prop,prop_label,status,rate,tax_occ,tax_sales,total,credit,contact_pref`);
    const rows = resp.ok ? await resp.json() : [];
    if (!rows.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No reservation found for that code' }) };
    }
    const r = rows[0];
    if (r.guest !== guest || r.email !== email || r.check_in !== check_in || r.check_out !== check_out) {
      return { statusCode: 409, body: JSON.stringify({ message: 'This link no longer matches the current reservation.' }) };
    }
    if (r.status !== 'signed') {
      // Nothing to confirm - status already moved on (e.g. Stripe's webhook beat this to it, or
      // it's already confirmed/cancelled). Not an error the guest needs to see.
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const fmt = n => '$' + (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fmtDate = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return s; } };
    const isRefund = method === 'Refund';
    const isEven = method === 'Even';
    const names = { venmo: 'Venmo', cashapp: 'Cash App', stripe: 'Credit Card', paypal: 'PayPal', Zelle: 'Zelle', Cash: 'Cash' };
    const methodLabel = isRefund ? 'No payment - refund owed' : isEven ? 'No payment - credit covers stay in full' : (names[method] || method);
    const rate = parseFloat(r.rate) || 0, taxOcc = parseFloat(r.tax_occ) || 0, taxSales = parseFloat(r.tax_sales) || 0;
    const credit = parseFloat(r.credit) || 0;
    const preTax = rate + taxOcc + taxSales;
    const receivedNow = isRefund || isEven ? 0 : Math.max(0, preTax - credit);
    const refundDue = isRefund ? Math.max(0, credit - preTax) : 0;

    // Jesse: "whenever I click a link from an email I always want to go to the guest profile
    // screen on admin" - this used to link straight to book.html's standalone confirm page, which
    // (a) had no reservation context for him to review before sending, and (b) when built from
    // scratch here rather than from the reservation's full saved quote URL, left book.html's
    // pricing display reading $0.00/0 nights (nights/rate/tax_occ/tax_sales/total are page-level
    // consts book.html parses once from its own URL params and never backfills from the DB).
    // admin.html?code=...&method=... sidesteps both: _openFromEmailLink() there opens the real
    // Guest Dashboard (full context, same PIN-gated admin session as every other admin action),
    // and Jesse confirming from there goes through _openQuickConfirm()'s existing, already-correct
    // book.html iframe flow, which builds its link from the reservation's own complete `url` column.
    const baseConfirmUrl = `https://theheartofcb.com/admin.html?code=${encodeURIComponent(code)}&method=${encodeURIComponent(method)}`;

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'The Heart Of CB <stay@theheartofcb.com>',
        to: ['jessejonesrealestate@gmail.com'],
        subject: isRefund
          ? `🔄 Signed - Refund Owed - ${r.guest} | ${fmtDate(r.check_in)}–${fmtDate(r.check_out)}`
          : isEven
          ? `✅ Signed - No Balance Due - ${r.guest} | ${fmtDate(r.check_in)}–${fmtDate(r.check_out)}`
          : `💰 Payment Sent - ${r.guest} | ${fmtDate(r.check_in)}–${fmtDate(r.check_out)}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.8;max-width:560px;">
        <div style="background:#0a1f3a;color:#fff;padding:18px 20px;border-radius:8px 8px 0 0;">
          <strong style="font-size:16px;">${isRefund ? '🔄 Updated Agreement Signed - Refund Owed' : isEven ? '✅ Updated Agreement Signed - No Balance Due' : '💰 Payment Sent - Verify &amp; Confirm'}</strong>
        </div>
        <div style="border:1px solid #e0d9cc;border-top:none;padding:18px 20px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:5px 0;color:#666;width:120px;">Guest</td><td style="padding:5px 0;font-weight:600;color:#0a1f3a;">${escapeHtml(r.guest)}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Email</td><td style="padding:5px 0;">${escapeHtml(r.email) || '-'}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Phone</td><td style="padding:5px 0;">${escapeHtml(r.phone) || '-'}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Property</td><td style="padding:5px 0;font-weight:600;">${escapeHtml(r.prop_label || r.prop)}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Check-In</td><td style="padding:5px 0;">${fmtDate(r.check_in)}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Check-Out</td><td style="padding:5px 0;">${fmtDate(r.check_out)}</td></tr>
            <tr><td style="padding:5px 0;color:#666;">Nights</td><td style="padding:5px 0;">${r.nights || ''}</td></tr>
            ${isRefund
              ? `<tr><td style="padding:5px 0;color:#7c1d1d;">Refund Owed</td><td style="padding:5px 0;font-weight:700;color:#7c1d1d;">${fmt(refundDue)}</td></tr>`
              : isEven
              ? `<tr><td style="padding:5px 0;color:#166534;">Balance Due</td><td style="padding:5px 0;font-weight:700;color:#166534;">${fmt(0)}</td></tr>`
              : `<tr><td style="padding:5px 0;color:#666;">${method === 'Cash' ? 'Verify in Venmo/Cash App/Zelle' : 'Total'}</td><td style="padding:5px 0;font-weight:700;">${receivedNow > 0 ? fmt(receivedNow) : 'Nothing sent yet - full cash at check-in'}</td></tr>`
            }
            <tr><td style="padding:5px 0;color:#666;">Payment via</td><td style="padding:5px 0;font-weight:700;color:#166534;">${methodLabel}</td></tr>
            ${r.contact_pref ? `<tr><td style="padding:5px 0;color:#666;">Prefers</td><td style="padding:5px 0;font-weight:700;">${r.contact_pref === 'text' ? '💬 Text' : r.contact_pref === 'email' ? '📧 Email' : '📧💬 Both'}</td></tr>` : ''}
          </table>
          <table role="presentation" style="width:100%;margin-top:14px;background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;border-collapse:collapse;">
            <tr><td colspan="2" style="padding:10px 14px 4px;font-size:12px;font-weight:800;color:#92400e;letter-spacing:.04em;">STEPS TO FINISH</td></tr>
            ${isRefund ? `<tr>
              <td style="padding:4px 6px 4px 14px;vertical-align:top;width:26px;"><span style="display:inline-block;background:#92400e;color:#fff;font-weight:800;font-size:12px;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;">1</span></td>
              <td style="padding:4px 14px 4px 0;font-size:13px;color:#92400e;"><strong>Send their ${fmt(refundDue)} refund.</strong></td>
            </tr>` : (!isEven && method) ? `<tr>
              <td style="padding:4px 6px 4px 14px;vertical-align:top;width:26px;"><span style="display:inline-block;background:#92400e;color:#fff;font-weight:800;font-size:12px;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;">1</span></td>
              <td style="padding:4px 14px 4px 0;font-size:13px;color:#92400e;"><strong>Verify receipt in ${methodLabel}.</strong></td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 6px 4px 14px;vertical-align:top;width:26px;"><span style="display:inline-block;background:#92400e;color:#fff;font-weight:800;font-size:12px;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;">${(isRefund || (!isEven && method)) ? '2' : '1'}</span></td>
              <td style="padding:4px 14px 4px 0;font-size:13px;color:#92400e;"><strong>Block these dates on Airbnb yourself</strong> - don't wait for the auto-sync, it can take hours.</td>
            </tr>
            <tr>
              <td style="padding:4px 6px 10px 14px;vertical-align:top;"><span style="display:inline-block;background:#92400e;color:#fff;font-weight:800;font-size:12px;border-radius:50%;width:20px;height:20px;line-height:20px;text-align:center;">${(isRefund || (!isEven && method)) ? '3' : '2'}</span></td>
              <td style="padding:4px 14px 10px 0;font-size:13px;color:#92400e;"><strong>Send the guest's confirmation</strong> via their preferred method.</td>
            </tr>
          </table>
          <div style="margin-top:14px;">
            <a href="${baseConfirmUrl}" style="display:block;background:#16a34a;color:#fff;padding:14px 16px;text-decoration:none;font-size:14px;font-weight:700;text-align:center;border-radius:8px;">→ Open Admin to Send Confirmation</a>
            <p style="margin:6px 0 0;font-size:11px;color:#999;text-align:center;">Opens this reservation's Guest Dashboard - review, then confirm and send from there</p>
          </div>
        </div>
      </div>`
      })
    });
    await emailResp.json().catch(() => ({}));
    if (!emailResp.ok) console.error('notify-host-payment-sent: Resend send failed');

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('notify-host-payment-sent failed:', e);
    // Best-effort - never blocks the guest's own "you're all set" flow.
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false }) };
  }
};
