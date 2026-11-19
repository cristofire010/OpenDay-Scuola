-- Via i turni: ogni postazione ha una capienza unica e ogni tutor al massimo due gruppi.

alter table open_day_stations add column if not exists capacity integer;

update open_day_stations
set capacity = greatest(1, capacity_per_slot * slot_count)
where capacity is null;

alter table open_day_stations alter column capacity set not null;
alter table open_day_stations alter column capacity set default 36;

alter table open_day_stations drop column if exists capacity_per_slot;
alter table open_day_stations drop column if exists slot_count;

drop index if exists open_day_participants_station_slot_idx;

alter table open_day_participants drop column if exists slot_index;
alter table open_day_participants drop column if exists slot_start;

create index if not exists open_day_participants_station_idx
  on open_day_participants (assigned_station_slug);
