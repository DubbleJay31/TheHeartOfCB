// Runs daily alongside the other reminders. Sends Jesse a single heads-up email listing any
// guest(s) checking in tomorrow — the only host-side arrival notice he wants (Airbnb's 8-day
// one is too far out to be useful).
exports.handler = async function(event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_KEY) {
    console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY required');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const sbResp = await fetch(
    `${SUPABASE_URL}/rest/v1/reservations?check_in=eq.${tomorrowStr}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!sbResp.ok) {
    const err = await sbResp.text();
    console.error('Supabase query error:', err);
    return { statusCode: 500, body: 'Supabase error: ' + err };
  }

  const reservations = await sbResp.json();
  console.log(`Arrival reminder: ${reservations.length} check-in(s) tomorrow (${tomorrowStr})`);

  if (!reservations.length) {
    return { statusCode: 200, body: JSON.stringify({ processed: 0 }) };
  }

  const emailResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: ['jessejonesrealestate@gmail.com'],
      subject: reservations.length === 1
        ? `Arriving tomorrow: ${reservations[0].guest}`
        : `${reservations.length} guests arriving tomorrow`,
      html: _buildArrivalHtml(reservations)
    })
  });
  const result = await emailResp.json().catch(() => ({}));
  console.log(emailResp.ok ? 'sent' : 'failed', result.id || '');

  return { statusCode: 200, body: JSON.stringify({ processed: reservations.length }) };
};

function _propName(prop) {
  if (typeof prop === 'string' && prop.includes('Front')) return '(FRONT) Home in The Heart Of CB';
  if (typeof prop === 'string' && prop.includes('Left')) return '(LEFT) Private Guest Suite';
  if (typeof prop === 'string' && prop.includes('Right')) return '(RIGHT) Private Guest Suite';
  return prop || 'The Heart Of CB';
}

function _buildArrivalHtml(reservations) {
  const fmtD = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch { return s; } };
  const fmt$ = n => '$' + parseFloat(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const cards = reservations.map(r => `
    <div style="background:#f8f6f0;border-radius:8px;padding:16px 18px;margin:0 0 14px;font-size:.93rem;">
      <div style="font-weight:700;color:#0a1f3a;font-size:1.05rem;margin-bottom:6px;">${r.guest}</div>
      <div style="margin-bottom:6px;"><strong>Property:</strong> ${_propName(r.prop)}</div>
      <div style="margin-bottom:6px;"><strong>Check-out:</strong> ${fmtD(r.check_out)}</div>
      ${r.total ? `<div style="margin-bottom:6px;"><strong>Total:</strong> ${fmt$(r.total)}</div>` : ''}
      ${r.email ? `<div style="margin-bottom:6px;"><strong>Email:</strong> ${r.email}</div>` : ''}
      ${r.host_notes ? `<div style="margin-top:8px;padding:8px 10px;background:#fbf0da;border-radius:6px;font-size:.85rem;color:#8a5a00;"><strong>Your note:</strong> ${r.host_notes}</div>` : ''}
    </div>`).join('');

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
      <h1 style="color:#c9a84c;font-size:1.2rem;margin:0;font-family:Georgia,serif;">Arriving Tomorrow</h1>
      <p style="color:#c9a84c;margin:.4rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
      ${cards}
    </div>
    <div style="background:#f8f6f0;padding:14px 32px;text-align:center;font-size:.72rem;color:#9ca3af;border-top:1px solid #e5e7eb;">
      The Heart Of CB · Carolina Beach, NC
    </div>
  </div>
</body>
</html>`;
}
