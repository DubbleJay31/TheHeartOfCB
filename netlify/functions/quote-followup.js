// Runs daily alongside reminder.js. For any quote expiring tomorrow that hasn't turned into a
// booking, sends the guest a low-pressure nudge and lets Jesse know — explicitly telling him the
// guest was already nudged, so he doesn't double up.
exports.handler = async function(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const JSONBIN_KEY  = process.env.JSONBIN_KEY;
  const JSONBIN_BIN  = process.env.JSONBIN_BIN;

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY || !JSONBIN_KEY || !JSONBIN_BIN) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, JSONBIN_KEY, JSONBIN_BIN required');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const binResp = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Meta': 'false' }
  });
  if (!binResp.ok) {
    console.error('jsonbin read error:', await binResp.text());
    return { statusCode: 500, body: 'jsonbin read failed' };
  }
  const data = await binResp.json();
  const quotes = data.quotes || [];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const candidates = quotes.filter(q => q.exp === tomorrowStr && q.email && q.guest && q.ci);
  console.log(`Quote follow-up: ${candidates.length} quote(s) expiring ${tomorrowStr}`);

  const results = [];
  for (const q of candidates) {
    try {
      const checkResp = await fetch(
        `${SUPABASE_URL}/rest/v1/reservations?email=eq.${encodeURIComponent(q.email)}&check_in=eq.${encodeURIComponent(q.ci)}&select=id`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const existing = checkResp.ok ? await checkResp.json() : [];
      if (existing.length > 0) {
        console.log(`Skipping ${q.guest} — already booked`);
        results.push({ guest: q.guest, status: 'already booked' });
        continue;
      }

      await _sendGuestNudge(q, RESEND_KEY);
      await _sendHostHeadsUp(q, RESEND_KEY);
      results.push({ guest: q.guest, status: 'sent' });
    } catch (e) {
      console.error(`Follow-up failed for ${q.guest}:`, e);
      results.push({ guest: q.guest, status: 'failed', error: String(e) });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ processed: candidates.length, results }) };
};

function _propName(prop) {
  if (prop === 'prop1') return '(FRONT) Home in The Heart Of CB';
  if (prop === 'prop2') return '(LEFT) Private Guest Suite';
  if (prop === 'prop3') return '(RIGHT) Private Guest Suite';
  return prop || 'The Heart Of CB';
}

async function _sendGuestNudge(q, RESEND_KEY) {
  const fmtD = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return s; } };
  const firstName = (q.guest || '').split(' ')[0] || 'there';
  const html = `<!DOCTYPE html>
<html>
<head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="font-family:Georgia,serif;background:#f8f6f0;margin:0;padding:20px;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#0a1f3a;padding:26px;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="58" height="58" bgcolor="#ffffff" align="center" valign="middle" style="background-color:#ffffff;border-radius:29px;">
        <img src="https://theheartofcb.com/THOCB%20Pin%20Square.png" width="56" height="56" alt="The Heart of CB" style="display:block;border-radius:50%;" />
      </td></tr></table>
      <div style="height:10px;"></div>
      <h1 style="color:#c9a84c;font-size:1.2rem;margin:0;font-family:Georgia,serif;">Still Thinking It Over?</h1>
      <p style="color:#c9a84c;margin:.4rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
      <p>Hi ${firstName},</p>
      <p>Just noticed your quote for ${_propName(q.prop)} is set to expire tomorrow. No pressure at all — plans change, and I get it!</p>
      <p>But if you're still weighing it, I'd love to have you. If something about the dates, price, or space isn't quite right, let me know — happy to see what I can work out. And if you just haven't had a chance to finish up, your link's still good:</p>
      <div style="text-align:center;margin:22px 0;">
        <a href="${q.url}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 28px;border-radius:7px;">View Your Booking →</a>
      </div>
      <p>📞 Jesse: <a href="tel:9105998118" style="color:#b8882a;text-decoration:none;">(910) 599-8118</a><br>
      📧 <a href="mailto:stay@theheartofcb.com" style="color:#b8882a;text-decoration:none;">stay@theheartofcb.com</a></p>
      <p>Either way — thanks for considering The Heart Of CB. Hope to host you soon!</p>
      <p style="margin-top:1.5rem;">Warm regards,<br><strong>Jesse</strong><br><em>The Heart Of CB</em></p>
    </div>
    <div style="background:#f8f6f0;padding:14px 32px;text-align:center;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;">
      The Heart Of CB · Carolina Beach, NC · <a href="https://theheartofcb.com" style="color:#9ca3af;">theheartofcb.com</a>
    </div>
  </div>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: [q.email],
      subject: `Still thinking about Carolina Beach? Your quote expires tomorrow`,
      html
    })
  });
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
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0a1f3a;">${q.guest}'s quote hasn't converted yet</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:5px 0;color:#666;width:110px;">Property</td><td style="color:#0a1f3a;">${_propName(q.prop)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Dates</td><td style="color:#0a1f3a;">${fmtD(q.ci)} – ${fmtD(q.co)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Total</td><td style="color:#0a1f3a;font-weight:700;">${fmt$(q.total)}</td></tr>
        <tr><td style="padding:5px 0;color:#666;">Email</td><td><a href="mailto:${q.email}" style="color:#b8882a;">${q.email}</a></td></tr>
      </table>
      <div style="background:#eaf3ff;border-radius:6px;padding:12px 14px;font-size:13px;color:#1d4e89;margin-bottom:18px;">
        📥 They've already been sent a friendly reminder — no need to double up unless you want to add a personal touch.
      </div>
      <div style="text-align:center;">
        <a href="${q.url}" style="display:inline-block;background:#b8882a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 26px;border-radius:7px;">View Their Booking Link →</a>
      </div>
    </div>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: ['jessejonesrealestate@gmail.com'],
      subject: `Quote expiring tomorrow: ${q.guest} · ${_propName(q.prop)}`,
      html
    })
  });
}
