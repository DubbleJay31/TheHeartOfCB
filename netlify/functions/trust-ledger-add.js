const { requireAdmin } = require('./_auth');
const { SB_URL, sbHeaders } = require('./_reservations');

const VALID_TYPES = ['deposit', 'draw'];
const VALID_CATEGORIES = ['owner', 'sales_tax', 'rot'];

// Admin-authenticated. Adds one entry to the trust deposit/draw ledger. `category` is required
// for a draw (which of the three "draw" buckets it comes out of) and optional for a deposit
// (deposits are logged for Jesse's own reference/reconciliation only - the trust balance itself
// is computed from reservation payments, not from logged deposits, so an uncategorized deposit
// doesn't affect any calculation).
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { entryDate, type, category, amount, note } = body;

  if (!entryDate || !VALID_TYPES.includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing or invalid entryDate/type' }) };
  }
  const amt = parseFloat(amount);
  if (!(amt > 0)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Amount must be greater than 0' }) };
  }
  if (type === 'draw' && !VALID_CATEGORIES.includes(category)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'A draw needs a category: owner, sales_tax, or rot' }) };
  }
  if (type === 'deposit' && category && !VALID_CATEGORIES.includes(category)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid category' }) };
  }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/trust_ledger`, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        entry_date: entryDate,
        type,
        category: type === 'deposit' ? (category || null) : category,
        amount: amt,
        note: note || null
      })
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ message: err }) };
    }
    const rows = await r.json();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, row: rows[0] }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
