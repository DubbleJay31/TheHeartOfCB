-- THOCB: unified reservation entity (inquiry -> quoted -> signed -> confirmed -> cancelled)
-- Run this manually in the Supabase SQL editor. Safe to run step-by-step and inspect between
-- steps - nothing here is auto-executed by the app.

-- 1. Add new columns (nullable at first, so this is safe to run before cleanup)
alter table reservations
  add column if not exists code text,
  add column if not exists status text default 'inquiry',
  add column if not exists updated_at timestamptz default now(),
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists prop_label text,
  add column if not exists credit numeric,
  add column if not exists guests_count text,
  add column if not exists pets text,
  add column if not exists message text,
  add column if not exists signed_name text,
  add column if not exists signed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists followup_sent_at timestamptz,
  add column if not exists exp date,
  add column if not exists url text;

-- 2. DESTRUCTIVE - wipes every existing row. Jesse confirmed all current data is test data.
--    Only run this when actually ready to cut over - do not run automatically.
-- truncate table reservations;

-- 3. Enforce constraints (run only AFTER truncating - a not-null/unique constraint will fail
--    against old rows that predate these columns)
alter table reservations
  alter column status set not null,
  alter column code set not null,
  add constraint reservations_status_check check (status in ('inquiry','quoted','signed','confirmed','cancelled')),
  add constraint reservations_code_unique unique (code);

create index if not exists reservations_status_idx on reservations(status);
create index if not exists reservations_check_in_idx on reservations(check_in);
create index if not exists reservations_check_out_idx on reservations(check_out);

-- 4. Drop the now-obsolete free-text notes column and the old prop-name inconsistency is
--    resolved in application code (prop stores the short key prop1/prop2/prop3 going forward,
--    prop_label carries the display name) - no schema change needed for that part.
alter table reservations drop column if exists notes;

-- Note: run step 2 (truncate) uncommented, by itself, only when ready to go live with the new
-- schema - after that, run step 3 to lock in the constraints.
