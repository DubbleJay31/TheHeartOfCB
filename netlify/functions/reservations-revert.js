const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

// Puts a change-pending reservation back exactly as it was before a Change Reservation edit -
// the counterpart to reservations-upsert.js's prior_terms snapshot. Admin-only: this is Jesse
// deciding not to go through with an edit, not something a guest capability token should ever
// be able to trigger.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const { code } = body;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  try {
    const curResp = await sbReservations(`?code=eq.${encodeURIComponent(code)}&select=status,prior_terms`);
    const cur = curResp.ok ? await curResp.json() : [];
    if (!cur.length) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, message: 'No reservation found for that code' }) };
    }
    const snapshot = cur[0].prior_terms;
    if (!snapshot) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Nothing to revert - no prior terms on file' }) };
    }
    // A snapshot only ever means something while the row is still sitting at 'quoted'/'signed'
    // pending the edit it was taken for - reservations-confirm.js and stripe-webhook.js both clear
    // prior_terms the moment a change gets legitimately confirmed, so a snapshot surviving past
    // that point (a race, or a gap in one of those two clearing it) must never be restored over an
    // already-confirmed, already-paid reservation.
    if (cur[0].status !== 'quoted' && cur[0].status !== 'signed') {
      return { statusCode: 409, body: JSON.stringify({ ok: false, message: 'This reservation is no longer awaiting confirmation - nothing to revert.' }) };
    }

    // cancelled_at restores from the snapshot itself (null if the snapshot's own status wasn't
    // cancelled) rather than being unconditionally cleared - a snapshot taken from a cancelled
    // reservation needs its cancellation timestamp back, not silently dropped.
    const row = { ...snapshot, prior_terms: null, updated_at: new Date().toISOString() };

    // Scoped to the same status this function just verified, not just `code` - the write-side
    // half of the same optimistic-concurrency guard reservations-confirm.js/stripe-webhook.js use
    // on their own status transitions, so a second edit landing between the check above and this
    // PATCH can't get silently clobbered by a stale revert.
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}&status=in.(quoted,signed)`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ ok: false, message: err }) };
    }
    const updated = await r.json().catch(() => []);
    if (!updated.length) {
      return { statusCode: 409, body: JSON.stringify({ ok: false, message: 'This reservation changed status just now - refresh and try again.' }) };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
