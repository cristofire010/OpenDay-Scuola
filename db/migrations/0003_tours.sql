alter table open_day_participants
  add column if not exists assigned_tutor_name text,
  add column if not exists group_size integer not null default 1;

update open_day_participants as participants
set assigned_tutor_name = stations.guide_name
from open_day_stations as stations
where participants.assigned_tutor_name is null
  and stations.slug = participants.assigned_station_slug;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'open_day_participants_group_size_check'
      and conrelid = 'open_day_participants'::regclass
  ) then
    alter table open_day_participants
      add constraint open_day_participants_group_size_check
      check (group_size between 1 and 6);
  end if;
end $$;

create table if not exists open_day_participant_stations (
  participant_id uuid not null references open_day_participants(id) on delete cascade,
  station_slug text not null references open_day_stations(slug),
  sort_order integer not null default 0,
  primary key (participant_id, station_slug),
  unique (participant_id, sort_order)
);

create index if not exists open_day_participant_stations_station_idx
  on open_day_participant_stations (station_slug);

insert into open_day_participant_stations (participant_id, station_slug, sort_order)
select id, assigned_station_slug, 0
from open_day_participants
on conflict (participant_id, station_slug) do nothing;

create index if not exists open_day_participants_tutor_slot_idx
  on open_day_participants (assigned_tutor_name, slot_index);
