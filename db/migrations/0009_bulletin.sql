-- Bacheca comune dei tutor: comunicazioni rapide condivise fra tutti i tutor.

create table if not exists open_day_bulletin_messages (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists open_day_bulletin_messages_created_idx
  on open_day_bulletin_messages (created_at desc);
