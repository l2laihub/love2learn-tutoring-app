# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver device push notifications to parents and tutors by firing an Expo push whenever a row is inserted into the existing `notifications` table, with payment reminders as the first live consumer.

**Architecture:** A Postgres `AFTER INSERT` trigger on `notifications` calls a new `send-push-notification` edge function via `pg_net`. The function resolves the recipient's auth user, checks their per-type notification preference, looks up their device tokens in a new `push_tokens` table, and sends via the Expo Push API. The React Native app registers/refreshes each device's Expo token on login and removes it on sign-out. Email via Resend is untouched; push is purely additive.

**Tech Stack:** Expo 54 / React Native 0.81, `expo-notifications`, `expo-device`, Supabase (Postgres + Edge Functions on Deno, `pg_net`, Vault), Expo Push API.

**Spec:** `docs/superpowers/specs/2026-06-04-push-notifications-design.md`

---

## Testing approach (read first)

This repo has **no JS test framework** (no jest/vitest, no `test` script). We will not add one — that is out of scope and against current conventions. Instead:

- **Edge function logic** is split into a pure module (`push.ts`) tested with Deno's built-in runner (`deno test`) — zero install, since edge functions already run on Deno. This is where the real branching logic lives, so this is where TDD applies.
- **React Native layer** (token registration, hook, screens) is mostly I/O glue around `expo-notifications` and has no test harness. It is verified with `npm run typecheck`, `npm run lint`, and a **manual physical-device checklist** (Task 12). This is an honest limitation, not a silent gap: push cannot run in Expo Go or a simulator, so a real device build is the only meaningful end-to-end test.

If `deno` is not installed: `brew install deno`.

---

## File structure

**Created:**
- `supabase/migrations/<ts>_push_tokens.sql` — `push_tokens` table, RLS, `upsert_push_token` RPC.
- `supabase/migrations/<ts>_push_notification_trigger.sql` — `pg_net` trigger on `notifications`.
- `supabase/functions/send-push-notification/push.ts` — pure helpers (type→pref mapping, message building).
- `supabase/functions/send-push-notification/push.test.ts` — Deno unit tests.
- `supabase/functions/send-push-notification/index.ts` — HTTP handler / I/O.
- `src/lib/push.ts` — device token register/unregister + permission helpers.
- `src/hooks/usePushNotifications.ts` — registration + tap-routing hook.
- `app/settings/notifications.tsx` — push on/off settings screen.

**Modified:**
- `src/types/database.ts` — add `push_tokens` table + `upsert_push_token` function types.
- `src/contexts/AuthContext.tsx` — mount the hook; wrap `signOut` to remove the token first.
- `app.config.ts` — add `expo-notifications` plugin.
- `app/(auth)/onboarding/notifications.tsx` — replace "coming soon" with a real Enable-notifications pre-prompt.
- `app/(tabs)/more.tsx` — add a "Notifications" menu entry.

---

## Prerequisites (operator, one-time — do before Task 5 / Task 6)

These are configuration actions the operator runs; they are not code and have no automated test. They are prerequisites for end-to-end delivery, **not** for writing/typechecking the code.

- [ ] **P1 — EAS push credentials.** Run `eas credentials` and configure **APNs** (iOS) and **FCM v1 / `google-services.json`** (Android) for the `huybuilds` account, project `80057121-e849-408e-bd31-10d40bb4934f`. Push only works in a **dev build / standalone build**, never Expo Go (SDK 53+).
- [ ] **P2 — Supabase Vault secrets** (used by the DB trigger to call the function). In the Supabase dashboard → Project Settings → Vault, add two secrets:
  - `project_url` = `https://<your-project-ref>.supabase.co`
  - `service_role_key` = the project's service role key
- [ ] **P3 — Edge function secret (optional).** If you enable Expo's push security, set `EXPO_ACCESS_TOKEN` via `npx supabase secrets set EXPO_ACCESS_TOKEN=...`. Basic Expo push works without it; the function only adds the header when present.

---

## Task 1: `push_tokens` table, RLS, and upsert RPC

**Files:**
- Create: `supabase/migrations/<ts>_push_tokens.sql`

- [ ] **Step 1: Create the migration file**

Run: `npx supabase migration new push_tokens`
This prints the created path, e.g. `supabase/migrations/20260604120000_push_tokens.sql`. Use that file in the next step.

- [ ] **Step 2: Write the migration SQL**

Paste into the new migration file:

```sql
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

  insert into push_tokens (user_id, token, platform, last_seen_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = now();
end;
$$;

grant execute on function upsert_push_token(text, text) to authenticated;
```

- [ ] **Step 3: Apply locally and verify it lands cleanly**

Run: `npx supabase start` (if the local stack isn't already running), then `npx supabase db reset`
Expected: migrations apply with no error, ending in `Finished supabase db reset`, including a line applying `..._push_tokens.sql`.

- [ ] **Step 4: Verify the table and RPC exist**

Run:
```bash
npx supabase db reset >/dev/null 2>&1; \
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "select count(*) from push_tokens;" \
  -c "select proname from pg_proc where proname = 'upsert_push_token';"
```
Expected: `count` returns `0`, and `proname` returns `upsert_push_token`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): add push_tokens table, RLS, and upsert_push_token RPC"
```

---

## Task 2: Add `push_tokens` types to the typed client

The app's Supabase client is typed via `src/types/database.ts`. Without these additions, `supabase.from('push_tokens')` and `supabase.rpc('upsert_push_token')` fail typecheck.

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add the `push_tokens` table type**

Inside `Database['public']['Tables']` (the same object that holds `parents`, around `src/types/database.ts:35`), add a sibling entry:

```typescript
    push_tokens: {
      Row: {
        id: string;
        user_id: string;
        token: string;
        platform: 'ios' | 'android' | 'web';
        created_at: string;
        last_seen_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        token: string;
        platform: 'ios' | 'android' | 'web';
        created_at?: string;
        last_seen_at?: string;
      };
      Update: {
        id?: string;
        user_id?: string;
        token?: string;
        platform?: 'ios' | 'android' | 'web';
        created_at?: string;
        last_seen_at?: string;
      };
    };
```

- [ ] **Step 2: Add the `upsert_push_token` function type**

Inside `Database['public']['Functions']`, add:

```typescript
    upsert_push_token: {
      Args: { p_token: string; p_platform: string };
      Returns: undefined;
    };
```

If `Functions` is currently `Record<string, never>` or `{ [_ in never]: never }`, replace it with an object literal containing the entry above.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(types): add push_tokens table and upsert_push_token to Database types"
```

---

## Task 3: Edge function pure logic (TDD)

The branching logic — type→preference mapping and message building — is pure and unit-tested with Deno.

**Files:**
- Create: `supabase/functions/send-push-notification/push.ts`
- Test: `supabase/functions/send-push-notification/push.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/send-push-notification/push.test.ts`:

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { preferenceKeyForType, shouldSendPush, buildExpoMessages } from './push.ts';

Deno.test('payment_due maps to the payment_due preference', () => {
  assertEquals(preferenceKeyForType('payment_due'), 'payment_due');
});

Deno.test('lesson_reminder maps to lesson_reminders preference', () => {
  assertEquals(preferenceKeyForType('lesson_reminder'), 'lesson_reminders');
});

Deno.test('unmapped type (general) returns null', () => {
  assertEquals(preferenceKeyForType('general'), null);
});

Deno.test('suppresses push when the mapped preference is explicitly false', () => {
  assertEquals(shouldSendPush('payment_due', { payment_due: false }), false);
});

Deno.test('sends push when preferences are missing', () => {
  assertEquals(shouldSendPush('payment_due', null), true);
});

Deno.test('sends push for an unmapped type even if other prefs are off', () => {
  assertEquals(shouldSendPush('reschedule_request', { payment_due: false }), true);
});

Deno.test('builds one Expo message per token with deep-link data', () => {
  const msgs = buildExpoMessages(['tok1', 'tok2'], {
    id: 'n1',
    recipient_id: 'p1',
    type: 'payment_due',
    title: 'Payment due',
    message: 'Your invoice is due',
    data: { payment_id: 'pay1' },
    action_url: '/payments',
  });
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].to, 'tok1');
  assertEquals(msgs[0].title, 'Payment due');
  assertEquals(msgs[0].data.action_url, '/payments');
  assertEquals(msgs[0].data.payment_id, 'pay1');
  assertEquals(msgs[0].data.notification_id, 'n1');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `deno test supabase/functions/send-push-notification/push.test.ts`
Expected: FAIL — module `./push.ts` not found / exports undefined.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/send-push-notification/push.ts`:

```typescript
// Pure helpers for the send-push-notification edge function.
// No I/O here so this module is unit-testable with `deno test`.

export type NotificationType =
  | 'announcement'
  | 'reschedule_request'
  | 'reschedule_response'
  | 'lesson_reminder'
  | 'worksheet_assigned'
  | 'payment_due'
  | 'general';

export interface NotificationRecord {
  id: string;
  recipient_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  action_url: string | null;
}

export interface NotificationPrefs {
  lesson_reminders?: boolean;
  worksheet_assigned?: boolean;
  payment_due?: boolean;
  lesson_notes?: boolean;
}

// Map a notification type to the matching parent-preference key, or null
// if no preference governs this type (those default to ON).
export function preferenceKeyForType(
  type: NotificationType,
): keyof NotificationPrefs | null {
  switch (type) {
    case 'payment_due':
      return 'payment_due';
    case 'lesson_reminder':
      return 'lesson_reminders';
    case 'worksheet_assigned':
      return 'worksheet_assigned';
    default:
      return null;
  }
}

// Decide whether to send a push, honoring an explicit opt-out only.
export function shouldSendPush(
  type: NotificationType,
  prefs: NotificationPrefs | null | undefined,
): boolean {
  const key = preferenceKeyForType(type);
  if (key === null) return true; // no governing preference
  if (!prefs) return true; // no prefs stored yet
  return prefs[key] !== false; // suppress only on explicit false
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

// One Expo push message per device token, carrying the deep-link target.
export function buildExpoMessages(
  tokens: string[],
  n: NotificationRecord,
): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: n.title,
    body: n.message,
    sound: 'default',
    data: {
      notification_id: n.id,
      action_url: n.action_url,
      ...(n.data ?? {}),
    },
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `deno test supabase/functions/send-push-notification/push.test.ts`
Expected: PASS — all 7 tests `ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-push-notification/push.ts supabase/functions/send-push-notification/push.test.ts
git commit -m "feat(edge): add pure push helpers with Deno tests"
```

---

## Task 4: Edge function HTTP handler

Wires the pure helpers to Supabase + Expo. Resolves the recipient's auth user and preferences, fetches native tokens, sends, and prunes dead tokens. Never throws to the caller.

**Files:**
- Create: `supabase/functions/send-push-notification/index.ts`

- [ ] **Step 1: Write the handler**

Create `supabase/functions/send-push-notification/index.ts`:

```typescript
/**
 * Edge Function: Send Push Notification
 *
 * Fired by a Postgres trigger (pg_net) AFTER INSERT on `notifications`.
 * Resolves the recipient's device tokens and sends an Expo push.
 * Isolated from email: failures are logged, never thrown to the caller.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  buildExpoMessages,
  NotificationRecord,
  shouldSendPush,
} from './push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    // pg_net sends { record }; a dashboard webhook also nests under `record`.
    const record: NotificationRecord = payload.record ?? payload;

    if (!record?.recipient_id) {
      return json({ skipped: 'no recipient (broadcast not pushed)' });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // recipient_id is parents.id → get the auth user_id and preferences.
    const { data: parent } = await supabase
      .from('parents')
      .select('user_id, preferences')
      .eq('id', record.recipient_id)
      .single();

    if (!parent?.user_id) {
      return json({ skipped: 'recipient has no auth user' });
    }

    const prefs = parent.preferences?.notifications ?? null;
    if (!shouldSendPush(record.type, prefs)) {
      return json({ skipped: 'preference disabled' });
    }

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', parent.user_id)
      .neq('platform', 'web');

    const tokens = (tokenRows ?? []).map((r: { token: string }) => r.token);
    if (tokens.length === 0) {
      return json({ skipped: 'no device tokens' });
    }

    const messages = buildExpoMessages(tokens, record);

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(expoAccessToken
          ? { Authorization: `Bearer ${expoAccessToken}` }
          : {}),
      },
      body: JSON.stringify(messages),
    });
    const result = await res.json();

    await pruneDeadTokens(supabase, tokens, result);

    return json({ sent: tokens.length, result });
  } catch (e) {
    console.error('[send-push-notification] error', e);
    // Return 200 so a push failure never blocks the originating action.
    return json({ error: String(e) }, 200);
  }
});

// Remove tokens Expo reports as DeviceNotRegistered.
async function pruneDeadTokens(
  supabase: ReturnType<typeof createClient>,
  tokens: string[],
  expoResult: { data?: Array<{ status?: string; details?: { error?: string } }> },
) {
  const tickets = expoResult?.data;
  if (!Array.isArray(tickets)) return;

  const dead: string[] = [];
  tickets.forEach((ticket, i) => {
    if (
      ticket?.status === 'error' &&
      ticket?.details?.error === 'DeviceNotRegistered'
    ) {
      dead.push(tokens[i]);
    }
  });

  if (dead.length > 0) {
    await supabase.from('push_tokens').delete().in('token', dead);
  }
}
```

- [ ] **Step 2: Verify the function bundles (type/parse check)**

Run: `deno check supabase/functions/send-push-notification/index.ts`
Expected: no errors (it resolves remote imports and type-checks). If `deno check` reports only remote-import network notices, re-run once to let Deno cache them.

- [ ] **Step 3: Re-run the unit tests to confirm nothing broke**

Run: `deno test supabase/functions/send-push-notification/push.test.ts`
Expected: PASS — 7 tests `ok`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-push-notification/index.ts
git commit -m "feat(edge): add send-push-notification handler"
```

---

## Task 5: Deploy the edge function (operator)

Deploy before creating the trigger (Task 6) so inserts have a live endpoint to call.

- [ ] **Step 1: Deploy**

Run: `npx supabase functions deploy send-push-notification`
Expected: `Deployed Function send-push-notification`.

- [ ] **Step 2: Confirm Prerequisites P1–P3 are done**

Verify EAS credentials (P1) and Vault secrets (P2) exist. The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically — no extra secret needed for those.

No commit (deploy only).

---

## Task 6: Trigger push on notification insert

**Files:**
- Create: `supabase/migrations/<ts>_push_notification_trigger.sql`

- [ ] **Step 1: Create the migration file**

Run: `npx supabase migration new push_notification_trigger`
Use the printed path in the next step.

- [ ] **Step 2: Write the trigger SQL**

```sql
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
```

- [ ] **Step 3: Apply locally to confirm it parses and installs**

Run: `npx supabase db reset`
Expected: completes with no error, applying `..._push_notification_trigger.sql`. (Locally there are no Vault secrets, so the function returns early — that is the intended safe no-op.)

- [ ] **Step 4: Verify the trigger exists**

Run:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "select tgname from pg_trigger where tgname = 'trigger_push_on_notification';"
```
Expected: returns `trigger_push_on_notification`.

- [ ] **Step 5: Push the migration to remote (operator)**

Run: `npx supabase db push`
Expected: applies both new migrations to the remote project.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): push notifications on notification insert via pg_net trigger"
```

---

## Task 7: Install client push dependencies and plugin

**Files:**
- Modify: `package.json` (via `expo install`)
- Modify: `app.config.ts`

- [ ] **Step 1: Install the packages (pins Expo-54-compatible versions)**

Run: `npx expo install expo-notifications expo-device`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Register the `expo-notifications` plugin**

In `app.config.ts`, add an entry to the `plugins` array (alongside `expo-router`, `expo-secure-store`, etc., around `app.config.ts:114`):

```typescript
    [
      'expo-notifications',
      {
        color: '#3D9CA8',
      },
    ],
```

- [ ] **Step 3: Verify config evaluates and types pass**

Run: `npx expo config --type public >/dev/null && npm run typecheck`
Expected: config prints with no error; typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.config.ts
git commit -m "chore(push): add expo-notifications and expo-device deps + plugin"
```

---

## Task 8: Device token register/unregister helpers

**Files:**
- Create: `src/lib/push.ts`

- [ ] **Step 1: Write the helper module**

Create `src/lib/push.ts`:

```typescript
/**
 * Device push notification helpers.
 *
 * Registration stores the device's Expo token in `push_tokens` via a
 * SECURITY DEFINER RPC. Unregister removes it (call before sign-out).
 * All functions no-op on web / non-device and swallow errors so push
 * setup never breaks app flow.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show banners/sound while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  // easConfig is populated in built apps but isn't always in the typings;
  // cast to read it without depending on the SDK's type surface.
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId
  );
}

export async function getPushPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Register (or refresh) this device's Expo token for the signed-in user.
 * Returns the token on success, or null if unsupported / not granted / error.
 * Does NOT prompt — only registers when permission is already granted.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });

    await supabase.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });

    return token;
  } catch (e) {
    console.warn('[push] register failed', e);
    return null;
  }
}

/**
 * Remove this device's token. Call BEFORE sign-out, while still
 * authenticated, so the RLS delete policy still applies.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });
    if (token) {
      await supabase.from('push_tokens').delete().eq('token', token);
    }
  } catch (e) {
    console.warn('[push] unregister failed', e);
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push.ts
git commit -m "feat(push): add device token register/unregister helpers"
```

---

## Task 9: Registration hook + AuthContext wiring

**Files:**
- Create: `src/hooks/usePushNotifications.ts`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Write the hook**

Create `src/hooks/usePushNotifications.ts`:

```typescript
/**
 * Registers/refreshes the device push token while authenticated, and routes
 * to a notification's deep link when the user taps it.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { registerForPushNotificationsAsync } from '../lib/push';

// Version-proof subscription type: infer it from the listener's return value
// (expo-notifications has renamed this type across SDKs).
type NotificationSubscription = ReturnType<
  typeof Notifications.addNotificationResponseReceivedListener
>;

export function usePushNotifications(isAuthenticated: boolean): void {
  const responseListener = useRef<NotificationSubscription | null>(null);

  // Silently register/refresh the token whenever the user is authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync();
  }, [isAuthenticated]);

  // Deep-link on notification tap.
  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.action_url as
          | string
          | undefined;
        if (url) {
          router.push(url as never);
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}
```

- [ ] **Step 2: Wire the hook and wrap sign-out in AuthContext**

In `src/contexts/AuthContext.tsx`:

a) Add imports near the top (after the existing `auth` import block, around `src/contexts/AuthContext.tsx:19`):

```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';
import { unregisterPushToken } from '../lib/push';
```

b) Inside `AuthProvider`, after `const authState = useAuthHook();` (`src/contexts/AuthContext.tsx:87`), mount the hook:

```typescript
  usePushNotifications(authState.isAuthenticated);
```

c) Add a sign-out wrapper that removes the token first. Add this just before the `const value: AuthContextType = {` block (`src/contexts/AuthContext.tsx:150`):

```typescript
  const handleSignOut = async () => {
    await unregisterPushToken();
    return signOut();
  };
```

d) In the `value` object, replace the passed-through `signOut,` with the wrapper:

```typescript
    signOut: handleSignOut,
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePushNotifications.ts src/contexts/AuthContext.tsx
git commit -m "feat(push): register token on auth and route on notification tap"
```

---

## Task 10: Onboarding — replace "coming soon" with a real enable prompt

**Files:**
- Modify: `app/(auth)/onboarding/notifications.tsx`

- [ ] **Step 1: Add imports and an enable handler**

In `app/(auth)/onboarding/notifications.tsx`, add to the imports (near `src/contexts/AuthContext` import, around line 21):

```typescript
import { requestPushPermission, registerForPushNotificationsAsync } from '../../../src/lib/push';
```

Add a handler inside the component, after `const toggleNotification = ...` (around line 84):

```typescript
  const [pushEnabled, setPushEnabled] = useState(false);

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    setPushEnabled(granted);
    if (granted) {
      await registerForPushNotificationsAsync();
    }
  };
```

- [ ] **Step 2: Replace the "coming soon" info note with an Enable control**

Replace the entire `{/* Info Note */}` block (the `View` with `styles.infoNote` containing "Push notifications coming soon!", around lines 172–182) with:

```tsx
        {/* Enable push */}
        <Pressable
          style={styles.enablePushButton}
          onPress={handleEnablePush}
          disabled={pushEnabled}
        >
          <Ionicons
            name={pushEnabled ? 'notifications' : 'notifications-outline'}
            size={20}
            color={pushEnabled ? colors.secondary.main : colors.primary.main}
          />
          <Text style={styles.enablePushText}>
            {pushEnabled
              ? 'Push notifications enabled'
              : 'Enable push notifications'}
          </Text>
        </Pressable>
        <Text style={styles.enablePushHint}>
          Get reminded about payments, lessons, and messages on this device. You
          can change this anytime in Settings.
        </Text>
```

- [ ] **Step 3: Add the new styles**

In the `StyleSheet.create({ ... })` at the bottom, add these keys (next to `infoNote`/`infoText`, around line 284):

```typescript
  enablePushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.subtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
  },
  enablePushText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary.dark,
  },
  enablePushHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
```

- [ ] **Step 4: Verify typecheck and lint pass**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/onboarding/notifications.tsx"
git commit -m "feat(onboarding): enable push notifications prompt (replaces coming-soon note)"
```

---

## Task 11: Settings — push on/off screen + entry point

A focused device-push toggle for users who skipped onboarding or want to turn push off. Reachable by both roles via the More menu.

**Files:**
- Create: `app/settings/notifications.tsx`
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Create the settings screen**

Create `app/settings/notifications.tsx`:

```tsx
/**
 * Notification Settings
 * Toggle device push notifications on/off for this device.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getPushPermissionStatus,
  requestPushPermission,
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from '../../src/lib/push';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);

  useEffect(() => {
    getPushPermissionStatus().then((status) => {
      setEnabled(status === 'granted');
      setPermanentlyDenied(status === 'denied');
    });
  }, []);

  const handleToggle = async (next: boolean) => {
    if (next) {
      const granted = await requestPushPermission();
      if (granted) {
        await registerForPushNotificationsAsync();
        setEnabled(true);
        setPermanentlyDenied(false);
      } else {
        // iOS only shows the native dialog once; send them to settings.
        setPermanentlyDenied(true);
        if (Platform.OS === 'ios') Linking.openURL('app-settings:');
      }
    } else {
      await unregisterPushToken();
      setEnabled(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.rowTitle}>Push Notifications</Text>
          <Text style={styles.rowDescription}>
            Get payment, lesson, and message alerts on this device.
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.neutral.border, true: colors.primary.main }}
          thumbColor={colors.neutral.white}
          ios_backgroundColor={colors.neutral.border}
        />
      </View>

      {permanentlyDenied && (
        <Text style={styles.hint}>
          Notifications are turned off in your device settings. Enable them there
          to start receiving push alerts.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    padding: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
```

- [ ] **Step 2: Register the screen's header in the root stack**

In `app/_layout.tsx`, add a `Stack.Screen` next to the existing `name="notifications"` entry (around `app/_layout.tsx:168`):

```tsx
      <Stack.Screen
        name="settings/notifications"
        options={{
          headerShown: true,
          headerTitle: 'Notifications',
          headerBackTitle: 'Back',
        }}
      />
```

- [ ] **Step 3: Add a More-menu entry**

In `app/(tabs)/more.tsx`, add an item to the `menuItems` array (it renders for both roles — leave `tutorOnly`/`parentOnly` unset):

```typescript
  {
    key: 'notifications-settings',
    label: 'Notifications',
    icon: 'notifications',
    href: '/settings/notifications',
    description: 'Manage push notifications',
  },
```

- [ ] **Step 4: Verify typecheck and lint pass**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/settings/notifications.tsx app/_layout.tsx "app/(tabs)/more.tsx"
git commit -m "feat(settings): add device push notification toggle screen"
```

---

## Task 12: Final verification

No code changes — confirm the whole feature is sound and document what only a real device can prove.

- [ ] **Step 1: Static checks**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 2: Edge function tests**

Run: `deno test supabase/functions/send-push-notification/push.test.ts`
Expected: 7 tests `ok`.

- [ ] **Step 3: Build a dev client (operator)**

Run: `eas build --profile development --platform ios` (and/or `--platform android`)
Expected: a build that can be installed on a physical device. (Push does not work in Expo Go or simulators.)

- [ ] **Step 4: Manual device checklist**

On a physical device running the dev build, with Prerequisites P1–P3 complete and the edge function deployed:

1. Complete parent onboarding → tap **Enable push notifications** → accept the OS prompt. Confirm a row appears in `push_tokens` for your user.
2. As a tutor, send a payment reminder to that parent. Confirm:
   - the push arrives on the device, and
   - tapping it opens the app at the invoice (`/payments`).
3. In Settings → Notifications, toggle push **off**. Confirm the `push_tokens` row is removed and a new reminder produces **no** push (email still arrives).
4. Toggle back **on**; in onboarding-set preferences, set Payment Reminders **off** and confirm a payment reminder sends **no** push but other types still do.
5. Sign out. Confirm the device's `push_tokens` row is deleted.

- [ ] **Step 5: Update the onboarding copy note in docs (if any references "coming soon")**

Run: `grep -rn "Push notifications coming soon" app/ src/`
Expected: no matches (the only occurrence was replaced in Task 10).

---

## Notes / deferred (out of scope)

- **Broadcast push** (`recipient_id IS NULL` announcements) is intentionally skipped to avoid mass fan-out; revisit with batching if needed.
- **SMS** remains deferred as a future high-deliverability channel for severely past-due invoices.
- No RN test harness is added; if one is introduced later, the hook and `push.ts` helpers are the natural first units to cover.
