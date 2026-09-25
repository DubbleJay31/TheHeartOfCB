-- Persists the admin-login PIN-attempt lockout across Netlify Function containers (overnight
-- audit 2026-09-25). The prior in-memory counter in admin-login.js only coordinated within one
-- warm container; Netlify scales out to multiple concurrent execution environments, so a
-- concurrent (not just sequential) PIN guesser could largely evade the 5-attempt lockout since
-- each parallel request had a real chance of landing on a fresh container with its own zeroed
-- counter. One shared row is enough - there's exactly one legitimate user of this endpoint (Jesse),
-- so this doesn't need to be keyed per-IP the way a multi-tenant app's would.
CREATE TABLE IF NOT EXISTS admin_login_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

INSERT INTO admin_login_state (id, failed_attempts, locked_until)
VALUES (1, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS enabled with no policies, matching trust_ledger/reported_payment_method - all access to this
-- table goes through admin-login.js's service-role key, never a client-side anon key, so there's
-- nothing for a policy to actually grant.
ALTER TABLE admin_login_state ENABLE ROW LEVEL SECURITY;
