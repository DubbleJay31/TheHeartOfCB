// Runs daily alongside reminder.js. For any quote expiring tomorrow that's still sitting at
// status='quoted' (never signed, never booked elsewhere), sends the guest a low-pressure nudge
// and lets Jesse know. Reads/writes the reservations table directly now - no JSONBin involved.
const { sbReservations, propLabel, escapeHtml } = require('./_reservations');

exports.handler = async function(event) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.error('Missing env var: RESEND_API_KEY required');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const sbResp = await sbReservations(
    `?status=eq.quoted&exp=eq.${tomorrowStr}&followup_sent_at=is.null&select=*`
  );
  if (!sbResp.ok) {
    const err = await sbResp.text();
    console.error('Supabase query error:', err);
    return { statusCode: 500, body: 'Supabase error: ' + err };
  }
  const candidates = (await sbResp.json()).filter(q => q.email && q.guest && q.check_in);
  console.log(`Quote follow-up: ${candidates.length} quote(s) expiring ${tomorrowStr}`);

  const results = [];
  for (const q of candidates) {
    try {
      await _sendGuestNudge(q, RESEND_KEY);
      await _sendHostHeadsUp(q, RESEND_KEY);
      await sbReservations(`?code=eq.${encodeURIComponent(q.code)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ followup_sent_at: new Date().toISOString() })
      });
      results.push('sent');
    } catch (e) {
      console.error(`Follow-up failed for ${q.guest}:`, e);
      results.push('failed');
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      processed: candidates.length,
      sent: results.filter(s => s === 'sent').length,
      failed: results.filter(s => s === 'failed').length
    })
  };
};

async function _sendGuestNudge(q, RESEND_KEY) {
  const firstName = (q.guest || '').split(' ')[0] || 'there';
  const html = `<!DOCTYPE html>
<html>
<head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="font-family:Georgia,serif;background:#f8f6f0;margin:0;padding:20px;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#0a1f3a;padding:26px;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="66" height="66" bgcolor="#b8882a" align="center" valign="middle" style="background-color:#b8882a;border-radius:33px;">
        <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="58" height="58" bgcolor="#ffffff" align="center" valign="middle" style="background-color:#ffffff;border-radius:29px;">
          <img src="https://theheartofcb.com/THOCB%20Pin%20Square.png" width="56" height="56" alt="The Heart of CB" style="display:block;border-radius:50%;" />
        </td></tr></table>
      </td></tr></table>
      <div style="height:10px;"></div>
      <h1 style="color:#c9a84c;font-size:1.2rem;margin:0;font-family:Georgia,serif;">Still Thinking It Over?</h1>
      <p style="color:#c9a84c;margin:.4rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Just noticed your quote for ${propLabel(q.prop)} is set to expire tomorrow. No pressure at all - plans change, and I get it!</p>
      <p>But if you're still weighing it, I'd love to have you. If something about the dates, price, or space isn't quite right, let me know - happy to see what I can work out. And if you just haven't had a chance to finish up, your link's still good:</p>
      <div style="text-align:center;margin:22px 0;">
        <a href="${q.url}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 28px;border-radius:7px;">View Your Booking →</a>
      </div>
      <p>📞 Jesse: <a href="tel:9105998118" style="color:#b8882a;text-decoration:none;">(910) 599-8118</a><br>
      📧 <a href="mailto:stay@theheartofcb.com" style="color:#b8882a;text-decoration:none;">stay@theheartofcb.com</a></p>
      <p>Either way - thanks for considering The Heart Of CB. Hope to host you soon!</p>
      <p style="margin-top:1.5rem;">Warm regards,<br><strong>Jesse</strong><br><em>The Heart Of CB</em></p>
    </div>
    <div style="background:#f8f6f0;padding:14px 32px;text-align:center;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;">
      The Heart Of CB · Carolina Beach, NC · <a href="https://theheartofcb.com" style="color:#9ca3af;">theheartofcb.com</a>
    </div>
  </div>
</body>
</html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: [q.email],
      subject: `Still thinking about Carolina Beach? Your quote expires tomorrow`,
      html
    })
  });
  if (!r.ok) throw new Error('Guest nudge send failed: ' + await r.text());
}

async function _sendHostHeadsUp(q, RESEND_KEY) {
  const fmtD = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return s; } };
  const fmt$ = n => '$' + parseFloat(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const html = `<div style="font-family:Georgia,serif;background:#f5f0e8;padding:24px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#0a1f3a;padding:20px 32px;text-align:center;">
      <div style="color:#b8882a;font-size:18px;font-weight:700;letter-spacing:.06em;">QUOTE EXPIRING TOMORROW</div>
      <div style="color:#c8b99a;font-size:12px;margin-top:2px;">The Heart of CB</div>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0a1f3a;">${escapeHtml(q.guest)}'s quote hasn't converted yet</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:5px 0;color:#666;width:110px;">Property</td><td style="color:#0a1f3a;">${propLabel(q.prop)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Dates</td><td style="color:#0a1f3a;">${fmtD(q.check_in)} – ${fmtD(q.check_out)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Total</td><td style="color:#0a1f3a;font-weight:700;">${fmt$(q.total)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Email</td><td><a href="mailto:${q.email}" style="color:#b8882a;">${q.email}</a></td></tr>
      </table>
      <div style="background:#eaf3ff;border-radius:6px;padding:12px 14px;font-size:13px;color:#1d4e89;margin-bottom:18px;">
        📥 They've already been sent a friendly reminder - no need to double up unless you want to add a personal touch.
      </div>
      <div style="text-align:center;">
        <a href="${q.url}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 26px;border-radius:7px;">View Their Booking Link →</a>
      </div>
    </div>
  </div>
</div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: ['jessejonesrealestate@gmail.com'],
      subject: `Quote expiring tomorrow: ${q.guest} · ${propLabel(q.prop)}`,
      html
    })
  });
  if (!r.ok) throw new Error('Host heads-up send failed: ' + await r.text());
}
