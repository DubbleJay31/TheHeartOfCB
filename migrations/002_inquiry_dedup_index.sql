-- THOCB: close the inquiry double-submit race condition
-- Run this manually in the Supabase SQL editor. Safe to run any time - purely additive, no data
-- changes, nothing here is auto-executed by the app.
--
-- reservations-inquiry.js already guards against an accidental double-submit (double-click, a
-- flaky connection retrying the POST) with an app-level check: "does a row with this
-- email+check_in+check_out already exist from the last 2 minutes?" That check-then-insert is not
-- atomic, so two truly simultaneous submits can both pass the check before either insert commits,
-- producing two rows for one inquiry. This index makes the database itself reject the second one.
--
-- Scoped to status='inquiry' only (a partial index), not the whole table - once an inquiry moves
-- past that status (quoted/signed/confirmed/cancelled), the same guest is free to submit a
-- genuinely new inquiry for the same dates later (e.g. their first request was declined and
-- they're asking again). This only ever blocks two inquiries for the same email+dates existing
-- AT THE SAME TIME while still raw, unactioned inquiries.

create unique index if not exists reservations_inquiry_dedup_idx
  on reservations (email, check_in, check_out)
  where status = 'inquiry';
