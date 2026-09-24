// Runs daily alongside the other reminders. Sends Jesse a single heads-up email listing any
// guest(s) checking in tomorrow - the only host-side arrival notice he wants (Airbnb's 8-day
// one is too far out to be useful).
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

  // arrival_reminder_sent_at guards against a duplicate cron invocation re-sending this digest -
  // the same idempotency pattern reminder.js/checkout-reminder.js/quote-followup.js already use
  // on their own *_sent_at columns, previously missing here (flagged in two prior audits).
  const sbResp = await sbReservations(`?check_in=eq.${tomorrowStr}&status=eq.confirmed&arrival_reminder_sent_at=is.null&select=*`);
  if (!sbResp.ok) {
    const err = await sbResp.text();
    console.error('Supabase query error:', err);
    return { statusCode: 500, body: 'Supabase error: ' + err };
  }

  const candidates = await sbResp.json();
  console.log(`Arrival reminder: ${candidates.length} check-in(s) tomorrow (${tomorrowStr})`);

  if (!candidates.length) {
    return { statusCode: 200, body: JSON.stringify({ processed: 0 }) };
  }

  // Claim BEFORE sending, not after - the query above and the mark-sent PATCH used to be two
  // separate steps with a gap between them, so two overlapping invocations of this same function
  // (a manual re-run landing next to the real cron tick, a platform-level retry) could both read
  // "not yet reminded" before either one's mark-sent PATCH landed, and both would email Jesse the
  // same digest. This PATCH is scoped by BOTH code AND arrival_reminder_sent_at=is.null and asks
  // for the updated rows back - only the first invocation's PATCH actually matches any rows for
  // a given code; a second, near-simultaneous invocation's identical PATCH matches zero of them,
  // so only the winner sends. If the send below fails, the claim is released (reset back to null)
  // so a genuine same-day retry can still go out - what this closes is a real duplicate send,
  // not a legitimate resend after a transient failure.
  const codes = candidates.map(r => r.code);
  const claimResp = await sbReservations(
    `?code=in.(${codes.map(c => encodeURIComponent(c)).join(',')})&arrival_reminder_sent_at=is.null`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ arrival_reminder_sent_at: new Date().toISOString() })
    }
  );
  const reservations = claimResp.ok ? await claimResp.json().catch(() => []) : [];
  if (!reservations.length) {
    console.log('Arrival reminder: lost the claim race (or claim failed) - nothing to send this run.');
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

  if (!emailResp.ok) {
    // Release the claim so a genuine retry (same day, before "tomorrow" rolls over) can still
    // send - this send attempt failed, it didn't lose a race, so there's nothing to protect here.
    const claimedCodes = reservations.map(r => r.code);
    await sbReservations(`?code=in.(${claimedCodes.map(c => encodeURIComponent(c)).join(',')})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ arrival_reminder_sent_at: null })
    }).catch(err => console.error('Failed to release arrival_reminder_sent_at claim:', err));
  }

  return { statusCode: 200, body: JSON.stringify({ processed: reservations.length }) };
};

function _buildArrivalHtml(reservations) {
  const fmtD = s => { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch { return s; } };
  const fmt$ = n => '$' + parseFloat(n || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const cards = reservations.map(r => `
    <div style="background:#f8f6f0;border-radius:8px;padding:16px 18px;margin:0 0 14px;font-size:.93rem;">
      <div style="font-weight:700;color:#0a1f3a;font-size:1.05rem;margin-bottom:6px;">${escapeHtml(r.guest)}</div>
      <div style="margin-bottom:6px;"><strong>Property:</strong> ${propLabel(r.prop)}</div>
      <div style="margin-bottom:6px;"><strong>Check-out:</strong> ${fmtD(r.check_out)}</div>
      ${r.total ? `<div style="margin-bottom:6px;"><strong>Total:</strong> ${fmt$(r.total)}</div>` : ''}
      ${r.email ? `<div style="margin-bottom:6px;"><strong>Email:</strong> ${escapeHtml(r.email)}</div>` : ''}
      ${r.host_notes ? `<div style="margin-top:8px;padding:8px 10px;background:#fbf0da;border-radius:6px;font-size:.85rem;color:#8a5a00;"><strong>Your note:</strong> ${escapeHtml(r.host_notes)}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html>
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
