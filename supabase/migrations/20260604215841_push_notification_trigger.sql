-- Fire a device push whenever a direct notification row is created.
-- Uses pg_net to call the send-push-notification edge function asynchronously,
-- so a push failure can never block or slow the originating insert.
create extension if not exists pg_net;

create or replace function notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  -- Skip broadcasts (recipient_id IS NULL) to avoid mass fan-out for now.
  if new.recipient_id is null then
    return new;
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url';

  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'service_role_key';

  -- If Vault secrets are not configured, skip silently (email still works).
  if v_url is null or v_key is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );

  return new;
end;
$$;

create trigger trigger_push_on_notification
  after insert on notifications
  for each row
  execute function notify_push_on_notification();
