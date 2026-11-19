-- Il QR contiene un codice breve invece del link alla pagina di conferma.

alter table open_day_participants add column if not exists scan_code text;

update open_day_participants
set scan_code = upper(substr(md5(id::text), 1, 8))
where scan_code is null;

alter table open_day_participants alter column scan_code set not null;

create unique index if not exists open_day_participants_scan_code_idx
  on open_day_participants (scan_code);
