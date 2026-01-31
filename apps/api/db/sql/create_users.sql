create table if not exists users (
  id text primary key,
  email text not null,
  name text,
  picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_email_key
  on users (email);
