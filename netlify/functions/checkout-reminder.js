// Runs daily at 8am ET (see netlify.toml). Sends the morning-of-checkout email to any guest
// checking out today - mirrors the Airbnb "checkout instructions" auto-message, adapted for
// direct bookings (no Airbnb private-review system here, so the review ask points to a reply
// email instead, matching how the homepage testimonials are actually sourced).
const { sbReservations } = require('./_reservations');

exports.handler = async function(event) {
  const RESEND_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_KEY) {
    console.error('Missing env var: RESEND_API_KEY required');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const sbResp = await sbReservations(
    `?check_out=eq.${todayStr}&status=eq.confirmed&checkout_reminder_sent_at=is.null&select=*`
  );
  if (!sbResp.ok) {
    const err = await sbResp.text();
    console.error('Supabase query error:', err);
    return { statusCode: 500, body: 'Supabase error: ' + err };
  }

  const reservations = await sbResp.json();
  console.log(`Checkout reminder: ${reservations.length} checkout(s) today (${todayStr})`);

  const results = [];
  for (const res of reservations) {
    // Isolated per-reservation, same reasoning as reminder.js: an unhandled exception used to
    // abort the whole run and silently skip every guest checking out later in the same batch.
    try {
      const recipients = [res.email].filter(Boolean);
      if (!recipients.length) {
        console.log(`Skipping ${res.guest} - no email on file`);
        continue;
      }
      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'The Heart Of CB <stay@theheartofcb.com>',
          to: recipients,
          subject: 'Checkout today at 11:00 AM - thank you for staying!',
          html: _buildCheckoutHtml(res)
        })
      });
      await emailResp.json().catch(() => ({}));
      const status = emailResp.ok ? 'sent' : 'failed';
      console.log(`${status}: ${res.guest} → ${recipients.join(', ')}`);
      results.push(status);

      if (emailResp.ok) {
        await sbReservations(`?code=eq.${encodeURIComponent(res.code)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ checkout_reminder_sent_at: new Date().toISOString() })
        }).catch(err => console.error(`Failed to mark checkout_reminder_sent_at for ${res.code}:`, err));
      }
    } catch (e) {
      console.error(`Checkout reminder failed for ${res.code}:`, e);
      results.push('failed');
    }
  }

  return { statusCode: 200, body: JSON.stringify({ processed: reservations.length, sent: results.filter(s => s === 'sent').length, failed: results.filter(s => s === 'failed').length }) };
};

function _buildCheckoutHtml(res) {
  const firstName = (res.guest || '').split(' ')[0] || 'there';
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
      <h1 style="color:#c9a84c;font-size:1.2rem;margin:0;font-family:Georgia,serif;">Checkout Day!</h1>
      <p style="color:#c9a84c;margin:.4rem 0 0;font-size:.85rem;">The Heart Of CB · Carolina Beach, NC</p>
    </div>
    <div style="padding:28px 32px;color:#374151;font-size:.97rem;line-height:1.6;">
      <p>Hi ${firstName}!</p>
      <p>I hope you've enjoyed your stay! This is an automated reminder that checkout is <strong>11:00 AM</strong> - about 3 hours from now.</p>
      <div style="background:#f9f6f0;border-left:3px solid #b8882a;border-radius:0 8px 8px 0;padding:16px 18px;margin:18px 0;font-size:.9rem;">
        <p style="margin:0 0 8px;font-weight:700;color:#0a1f3a;">Checkout Instructions</p>
        <p style="margin:0;line-height:1.9;">
          ✓ Do not strip bed - straighten sheets, blankets not balled up<br>
          ✓ Leave used towels in the bathroom<br>
          ✓ Wash used dishes<br>
          ✓ Remove all food and drinks from the refrigerator<br>
          ✓ Wipe up spills, pick up trash, return items where they belong<br>
          ✓ Take kitchen and bathroom trash to the outdoor cans under the front stairs<br>
          ✓ Do a final walk-through - make sure nothing is left behind<br>
          <strong>✓ Text Jesse when you leave: (910) 599-8118</strong>
        </p>
        <p style="margin:10px 0 0;font-size:.85rem;font-style:italic;color:#6b7280;">If you know your checkout time in advance - especially if you'll be leaving early - let me know as soon as possible so I can plan cleaning and get the house ready for the next guest.</p>
      </div>
      <div style="background:#f8f6f0;border-radius:8px;padding:16px 18px;margin:18px 0;font-size:.9rem;">
        <p style="margin:0;font-style:italic;color:#4b5563;">I hope you had an incredible stay! My goal is to give every guest a 5-star experience - if anything wasn't perfect, just reply to this email and let me know so I can make it right. I genuinely read every reply, and many of the small touches in this home came directly from past guests' feedback. And if you loved it, I'd be grateful for a quick word - some guest replies end up featured right on the site.</p>
      </div>
      <p>Safe travels, and thank you so much for staying!</p>
      <p style="margin-top:1.5rem;">
        Sincerely,<br>
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
