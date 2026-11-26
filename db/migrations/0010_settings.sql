-- Impostazioni modificabili dall'area riservata (chiave/valore).
-- Serve alla password comune dei tutor: hash + interruttore di attivazione.

create table if not exists open_day_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
