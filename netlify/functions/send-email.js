const ALLOWED_ORIGINS = [
  'https://theheartofcb.com',
  'https://www.theheartofcb.com',
  'https://theheartofcarolinabeach.com',
  'https://www.theheartofcarolinabeach.com',
  'https://heartofcarolinabeach.com',
  'https://www.heartofcarolinabeach.com'
];

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // This endpoint has to stay reachable without a login (guests trigger it just by submitting
  // the inquiry form), so it can't be PIN-gated like the admin functions. An Origin check is a
  // real but partial mitigation - it stops casual scanning/browser-based abuse, not a determined
  // attacker scripting requests directly, since Origin is just a header they could also fake.
  const origin = event.headers.origin || event.headers.Origin || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Origin not allowed' }) };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) };
  }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: to, subject, html' }) };
  }
  if (typeof html === 'string' && html.length > 100000) {
    return { statusCode: 400, body: JSON.stringify({ message: 'html too large' }) };
  }

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length > 5) {
    return { statusCode: 400, body: JSON.stringify({ message: 'too many recipients' }) };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'The Heart Of CB <stay@theheartofcb.com>',
      to: recipients,
      subject,
      html
    })
  });

  const result = await resp.json().catch(() => ({}));
  return {
    statusCode: resp.ok ? 200 : resp.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  };
};
