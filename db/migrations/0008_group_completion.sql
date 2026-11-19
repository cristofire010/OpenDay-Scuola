-- Il tutor chiude il turno del gruppo quando il giro è finito.

alter table open_day_participants add column if not exists completed_at timestamptz;
