-- Hourly cron: for each enabled tutor where it's ~23:00 local, POST { tutor_id }
-- to the auto-complete-lessons edge function via pg_net. Pure dispatcher — the
-- edge function does the work and is idempotent (only touches scheduled lessons).
create extension if not exists pg_net;

create or replace function auto_complete_due_lessons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_tutor record;
  v_local timestamp;   -- wall-clock time in the tutor's tz
  v_count integer := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'Vault secrets missing; skipping auto-complete dispatch';
    return 0;
  end if;

  for v_tutor in
    select id, coalesce(timezone, 'America/Los_Angeles') as tz
    from parents
    where role = 'tutor'
      and auto_complete_lessons = true
  loop
    begin
      v_local := now() at time zone v_tutor.tz;

      -- End of day, tutor-local. Single hour; missed runs self-heal next night
      -- because the edge function processes ALL past-due scheduled lessons.
      if extract(hour from v_local) = 23 then
        perform net.http_post(
          url := v_url || '/functions/v1/auto-complete-lessons',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
          ),
          body := jsonb_build_object('tutor_id', v_tutor.id)
        );
        v_count := v_count + 1;
      end if;
    exception when others then
      raise notice 'auto-complete dispatch failed for tutor %: %', v_tutor.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function auto_complete_due_lessons() to service_role;

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'auto-complete-lessons') then
      perform cron.unschedule('auto-complete-lessons');
    end if;
    perform cron.schedule(
      'auto-complete-lessons',
      '0 * * * *',  -- top of every hour; the function filters to 23:00 local
      'SELECT auto_complete_due_lessons()'
    );
    raise notice 'auto-complete-lessons cron scheduled';
  else
    raise notice 'pg_cron not available; call auto_complete_due_lessons() manually or enable pg_cron';
  end if;
exception when others then
  raise notice 'Could not schedule auto-complete cron: %', sqlerrm;
end $outer$;

comment on function auto_complete_due_lessons() is
  'Hourly: dispatches end-of-day (23:00 tutor-local) auto-complete to enabled tutors via pg_net.';
