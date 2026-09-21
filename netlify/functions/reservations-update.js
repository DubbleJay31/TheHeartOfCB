const { requireAdmin } = require('./_auth');
const { sbReservations } = require('./_reservations');

// Admin-only field update: the private host_notes field, and soft-cancelling a reservation
// (status -> 'cancelled', row retained rather than deleted - a hard delete is a separate,
// rarely-used cleanup action in reservations-delete.js).
exports.handler = async function(event) {
  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const code = (event.queryStringParameters || {}).code;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing code' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

  const patch = {};
  if (typeof body.host_notes === 'string') patch.host_notes = body.host_notes;
  if (body.status === 'cancelled') {
    patch.status = 'cancelled';
    patch.cancelled_at = new Date().toISOString();
  }
  // Reactivating a cancelled reservation - admin-only (same as everything else here), so no
  // guest-facing capability token can ever reach this. Puts it back exactly as it was (the terms
  // and signature already on the row never changed just because it got cancelled).
  if (body.status === 'confirmed') {
    patch.status = 'confirmed';
    patch.cancelled_at = null;
  }
  if (!Object.keys(patch).length) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Nothing to update' }) };
  }
  patch.updated_at = new Date().toISOString();

  try {
    // return=representation (not minimal) so a stale/deleted code - matching zero rows - can be
    // told apart from an actual update. PostgREST returns 2xx for a zero-row match just as
    // readily as a real one, so without this a stale code would report success while writing
    // nothing.
    const r = await sbReservations(`?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ message: err }) };
    }
    const updated = await r.json().catch(() => []);
    if (!updated.length) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No reservation found for that code' }) };
    }
    return { statusCode: 204, body: '' };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ message: String(e) }) };
  }
};
