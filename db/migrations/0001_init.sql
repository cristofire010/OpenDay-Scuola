-- Tabelle base dell'open day. Idempotente: si può rilanciare senza danni.

create table if not exists open_day_stations (
  slug text primary key,
  station_code text not null unique,
  title text not null,
  guide_name text not null,
  guide_role text not null,
  room text not null,
  meeting_point text not null,
  directions text not null,
  accent text not null,
  capacity_per_slot integer not null default 6,
  slot_count integer not null default 6,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists open_day_participants (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  requested_station_slug text,
  assigned_station_slug text not null,
  slot_index integer not null,
  slot_start text not null,
  status text not null default 'assigned',
  created_at timestamptz not null default now(),
  arrived_at timestamptz
);

create index if not exists open_day_participants_station_slot_idx
  on open_day_participants (assigned_station_slug, slot_index);
