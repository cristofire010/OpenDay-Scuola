-- Anti-duplicati (un cookie per dispositivo) e rate limit su Postgres,
-- così funziona anche con più istanze serverless.

alter table open_day_participants add column if not exists device_id text;

create index if not exists open_day_participants_device_idx
  on open_day_participants (device_id);

create table if not exists open_day_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);
