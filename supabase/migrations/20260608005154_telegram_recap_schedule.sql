-- Hourly cron: for each linked+enabled tutor where it's Saturday ~8 AM local and
-- this week's recap hasn't been sent, call send-telegram-recap via pg_net.
create extension if not exists pg_net;

create or replace function send_weekly_tutor_recaps()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_tutor record;
  v_local timestamp;        -- wall-clock time in the tutor's tz (no tz re-interpretation)
  v_week_start date;
  v_count integer := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'Vault secrets missing; skipping telegram recap dispatch';
    return 0;
  end if;

  -- Opportunistic cleanup of stale link tokens (cheap, keeps the table small).
  delete from telegram_link_tokens where expires_at < now() - interval '1 day';

  for v_tutor in
    select id, coalesce(timezone, 'America/Los_Angeles') as tz
    from parents
    where telegram_chat_id is not null
      and telegram_recap_enabled = true
      and role = 'tutor'
  loop
    -- Current wall-clock time in the tutor's timezone.
    v_local := now() at time zone v_tutor.tz;

    -- Saturday (DOW 6) and the 8 AM hour.
    if extract(dow from v_local) = 6 and extract(hour from v_local) = 8 then
      -- The Sunday that began this recap week = local date - 6 days.
      v_week_start := (v_local::date) - 6;

      -- Idempotency: skip if already sent for this week.
      if not exists (
        select 1 from telegram_recap_log
        where tutor_id = v_tutor.id and week_start = v_week_start
      ) then
        perform net.http_post(
          url := v_url || '/functions/v1/send-telegram-recap',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
          ),
          body := jsonb_build_object('tutor_id', v_tutor.id, 'week_start', v_week_start)
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function send_weekly_tutor_recaps() to service_role;

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'telegram-weekly-recaps') then
      perform cron.unschedule('telegram-weekly-recaps');
    end if;
    perform cron.schedule(
      'telegram-weekly-recaps',
      '0 * * * *',  -- top of every hour; the function filters to Sat 8 AM local
      'SELECT send_weekly_tutor_recaps()'
    );
    raise notice 'telegram-weekly-recaps cron scheduled';
  else
    raise notice 'pg_cron not available; call send_weekly_tutor_recaps() manually or enable pg_cron';
  end if;
exception when others then
  raise notice 'Could not schedule telegram recap cron: %', sqlerrm;
end $outer$;

comment on function send_weekly_tutor_recaps() is 'Hourly: dispatches Saturday 8AM-local weekly Telegram recaps to linked tutors (idempotent via telegram_recap_log).';
