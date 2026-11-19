-- Il tutor è la persona che accompagna il gruppo: il nome dell'account è il
-- nome con cui i giri vengono assegnati. I nomi guida segnaposto spariscono.

do $$
declare
  fallback text;
begin
  select display_name into fallback
  from open_day_tutor_accounts
  where active
  order by created_at
  limit 1;

  if fallback is not null then
    update open_day_participants as participants
    set assigned_tutor_name = fallback
    where participants.assigned_tutor_name is null
       or not exists (
         select 1
         from open_day_tutor_accounts as accounts
         where accounts.active
           and accounts.display_name = participants.assigned_tutor_name
       );
  end if;
end $$;

alter table open_day_tutor_accounts drop column if exists guide_name;
