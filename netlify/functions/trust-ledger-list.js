const { requireAdmin } = require('./_auth');
const { SB_URL, sbHeaders } = require('./_reservations');

// Admin-authenticated. Returns the full deposit/draw ledger, newest first - admin.html sums
// draws against reservation-derived earned/owed totals to show what should currently be in the
// trust account (see _trustBalances() there for the actual math).
exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/trust_ledger?order=entry_date.desc,id.desc&select=*`, {
      headers: sbHeaders()
    });
    const body = await r.text();
    return { statusCode: r.status, headers: { 'Content-Type': 'application/json' }, body };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
