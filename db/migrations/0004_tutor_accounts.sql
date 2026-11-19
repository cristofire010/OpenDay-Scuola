-- Account tutor: nome utente + password (hash scrypt), gestiti dalla regia.
-- Sostituiscono il PIN unico: ogni tutor entra solo con il proprio account.

create table if not exists open_day_tutor_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  guide_name text not null,
  password_hash text not null,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists open_day_tutor_accounts_guide_idx
  on open_day_tutor_accounts (guide_name);
