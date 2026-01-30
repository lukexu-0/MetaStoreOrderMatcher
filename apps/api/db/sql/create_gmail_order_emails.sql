create extension if not exists "pgcrypto";

create table if not exists gmail_order_emails (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  email_id text not null,
  email_date timestamptz not null,
  tracking_number text not null default '',
  quantity integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists gmail_order_emails_user_email_id_key
  on gmail_order_emails (user_id, email_id);

create index if not exists gmail_order_emails_user_date_idx
  on gmail_order_emails (user_id, email_date desc);
