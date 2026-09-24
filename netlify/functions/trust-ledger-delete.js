const { requireAdmin } = require('./_auth');
const { SB_URL, sbHeaders } = require('./_reservations');

// Admin-authenticated. Removes one ledger entry (typo/correction cleanup) by id.
exports.handler = async function(event) {
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const id = (event.queryStringParameters || {}).id;
  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing id' }) };
  }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/trust_ledger?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: sbHeaders({ Prefer: 'return=representation' })
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ message: err }) };
    }
    const deleted = await r.json().catch(() => []);
    if (!deleted.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No ledger entry found for that id' }) };
    }
    return { statusCode: 204, body: '' };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
