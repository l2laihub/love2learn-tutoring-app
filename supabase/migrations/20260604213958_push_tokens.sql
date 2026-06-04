-- Device push tokens for Expo push notifications.
-- One row per device; a user may have several (phone, tablet).
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on push_tokens(user_id);

alter table push_tokens enable row level security;

-- A user may read and remove only their own tokens.
create policy "push_tokens select own"
  on push_tokens for select to authenticated
  using (user_id = auth.uid());

create policy "push_tokens delete own"
  on push_tokens for delete to authenticated
  using (user_id = auth.uid());

-- Writes go through a SECURITY DEFINER RPC so a device that switches
-- accounts can re-own its token without tripping cross-user RLS.
create or replace function upsert_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Never transfer ownership of an existing token to a different user.
  -- The WHERE guard means a conflict on a token owned by someone else is a
  -- no-op (fail closed) rather than a hijack: a caller who merely knows another
  -- user's token string cannot claim it. The legitimate shared-device case
  -- (user A signs out, user B signs in) works because sign-out deletes A's row,
  -- so B's registration inserts cleanly with no conflict.
  insert into push_tokens (user_id, token, platform, last_seen_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
    set platform = excluded.platform,
        last_seen_at = now()
    where push_tokens.user_id = auth.uid();
end;
$$;

grant execute on function upsert_push_token(text, text) to authenticated;
