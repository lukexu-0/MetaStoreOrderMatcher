-- Adds user_id to spreadsheets and enables per-user filtering.
-- If you already have rows, backfill user_id before setting NOT NULL.

alter table if exists spreadsheets
  add column if not exists user_id text;

-- Backfill existing rows if needed:
-- update spreadsheets set user_id = '<YOUR_USER_ID>' where user_id is null;

alter table if exists spreadsheets
  alter column user_id set not null;

create index if not exists spreadsheets_user_id_month_idx
  on spreadsheets (user_id, month);
