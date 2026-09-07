exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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

  const recipients = Array.isArray(to) ? to : [to];

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
