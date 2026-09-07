exports.handler = async function(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY required');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const target = new Date();
  target.setDate(target.getDate() + 7);
  const dateStr = target.toISOString().split('T')[0];

  const sbResp = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?check_in=eq.${dateStr}&select=*`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!sbResp.ok) {
    const err = await sbResp.text();
    console.error('Supabase query error:', err);
    return { statusCode: 500, body: 'Supabase error: ' + err };
  }

  const reservations = await sbResp.json();
  console.log(`Reminder job: found ${reservations.length} reservations checking in on ${dateStr}`);

  const results = [];
  for (const res of reservations) {
    const recipients = [res.email, ...(res.additional_contacts || [])].filter(Boolean);
    if (!recipients.length) {
      console.log(`Skipping ${res.guest} — no email on file`);
      continue;
    }

    const html = buildReminderHtml(res);
    const propLabel = propName(res.prop);

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'The Heart Of CB <stay@theheartofcb.com>',
        to: recipients,
        subject: `Your stay is 7 days away — ${propLabel}`,
        html
      })
    });

    const result = await emailResp.json().catch(() => ({}));
    const status = emailResp.ok ? 'sent' : 'failed';
    console.log(`${status}: ${res.guest} → ${recipients.join(', ')}`);
    results.push({ guest: res.guest, status, id: result.id });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: reservations.length, results })
  };
};

function propName(prop) {
  if (prop === 'prop1') return '(FRONT) Home in The Heart Of CB';
  if (prop === 'prop2') return '(LEFT) Private Guest Suite';
  if (prop === 'prop3') return '(RIGHT) Private Guest Suite';
  return prop || 'Your Stay';
}

function buildReminderHtml(res) {
  const fmtD = s => new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  const fmt$ = n => '$' + parseFloat(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `<!DOCTYPE html>
<html>
<head><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></head>
<body style="font-family:Georgia,serif;background:#f8f6f0;margin:0;padding:20px;">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <div style="background:#0a1f3a;padding:26px;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="58" height="58" bgcolor="#ffffff" align="center" valign="middle" style="background-color:#ffffff;border-radius:29px;">
        <img src="https://theheartofcb.com/THOCB%20Pin%20Square.png" width="50" height="50" alt="The Heart of CB" style="display:block;border-radius:50%;" />
      </td></tr></table>
      <div style="height:10px;"></div>
      <h1 style="color:#c9a84c;font-size:1.25rem;margin:0;font-family:Georgia,serif;">
        Your Stay Is One Week Away!
      </h1>
      <p style="color:#c9a84c;margin:.4rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
      <p>Hi ${res.guest},</p>
      <p>We're so excited to host you soon! Here's a reminder of your upcoming stay:</p>
      <div style="background:#f8f6f0;border-radius:8px;padding:18px 20px;margin:16px 0;font-size:.93rem;">
        <div style="margin-bottom:8px;"><strong>Property:</strong> ${propName(res.prop)}</div>
        <div style="margin-bottom:8px;"><strong>Check-in:</strong> ${fmtD(res.check_in)}</div>
        <div style="margin-bottom:8px;"><strong>Check-out:</strong> ${fmtD(res.check_out)}</div>
        ${res.nights ? `<div style="margin-bottom:8px;"><strong>Nights:</strong> ${res.nights}</div>` : ''}
        ${res.total  ? `<div><strong>Total:</strong> ${fmt$(res.total)}</div>` : ''}
      </div>
      <p>Check-in details and door access instructions will be sent before your arrival. If you have any questions in the meantime, don't hesitate to reach out:</p>
      <p>
        📞 <strong>Alison Baringer:</strong> <a href="tel:3303097037" style="color:#b8882a;text-decoration:none;">330-309-7037</a><br>
        📧 <a href="mailto:stay@theheartofcb.com" style="color:#b8882a;text-decoration:none;">stay@theheartofcb.com</a>
      </p>
      <p>We can't wait to have you at The Heart Of CB. Safe travels!</p>
      <p style="margin-top:1.5rem;">
        Warm regards,<br>
        <strong>Jesse</strong><br>
        <em>The Heart Of CB</em>
      </p>
    </div>
    <div style="background:#f8f6f0;padding:14px 32px;text-align:center;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;">
      The Heart Of CB · Carolina Beach, NC · <a href="https://theheartofcb.com" style="color:#9ca3af;">theheartofcb.com</a>
    </div>
  </div>
</body>
</html>`;
}
