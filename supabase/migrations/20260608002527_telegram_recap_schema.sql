-- Weekly Telegram recap: tutor linking + scheduling support tables.
--
-- Note on the RLS helper: this repo's get_current_user_parent() returns a
-- TABLE (set of rows), not a scalar uuid, so it is used everywhere as
-- (SELECT id FROM public.get_current_user_parent() LIMIT 1) — see
-- 20260111000003_update_get_current_user_parent.sql. We follow that pattern
-- here for both the RLS policies and the SECURITY DEFINER RPC.

-- 1. Telegram fields on the shared parents table (tutors live here too).
alter table parents
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_linked_at timestamptz,
  add column if not exists telegram_recap_enabled boolean not null default true;

comment on column parents.telegram_chat_id is 'Linked Telegram chat ID for weekly recap (null = not linked).';
comment on column parents.telegram_recap_enabled is 'Tutor toggle to pause the weekly recap without disconnecting.';

-- 2. One-time deep-link tokens for the /start linking flow.
create table if not exists telegram_link_tokens (
  token uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references parents(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
create index if not exists idx_telegram_link_tokens_tutor on telegram_link_tokens(tutor_id);

-- 3. Per-week send log → idempotency for the hourly cron.
create table if not exists telegram_recap_log (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references parents(id) on delete cascade,
  week_start date not null,            -- the Sunday of the recapped week
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent','error')), -- 'sent' | 'error'
  error text,
  unique (tutor_id, week_start)
);
create index if not exists idx_telegram_recap_log_tutor on telegram_recap_log(tutor_id);

-- 4. RLS: tutors read their own log/tokens; writes go through SECURITY DEFINER
--    functions and the service-role edge function, so no broad write policies.
alter table telegram_link_tokens enable row level security;
alter table telegram_recap_log enable row level security;

drop policy if exists "tutor reads own link tokens" on telegram_link_tokens;
create policy "tutor reads own link tokens" on telegram_link_tokens
  for select to authenticated using (tutor_id = (select id from public.get_current_user_parent() limit 1));

drop policy if exists "tutor reads own recap log" on telegram_recap_log;
create policy "tutor reads own recap log" on telegram_recap_log
  for select to authenticated using (tutor_id = (select id from public.get_current_user_parent() limit 1));

-- 5. RPC the app calls to mint a deep-link token for the current tutor.
create or replace function create_telegram_link_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_token uuid;
begin
  select id into v_tutor_id from public.get_current_user_parent() limit 1;
  if v_tutor_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into telegram_link_tokens (tutor_id)
  values (v_tutor_id)
  returning token into v_token;

  return v_token;
end;
$$;

grant execute on function create_telegram_link_token() to authenticated;
