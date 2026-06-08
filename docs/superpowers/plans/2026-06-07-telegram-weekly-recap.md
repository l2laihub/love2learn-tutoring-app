# Weekly Telegram Recap for Tutors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send tutors a Saturday-morning Telegram recap of the week's classes (Sun–Fri) and payments, with a one-tap account-linking flow and an on-demand preview.

**Architecture:** A new Telegram bot links to tutors via a `/start <token>` deep link captured by a `telegram-webhook` edge function. A `pg_cron` job runs hourly and, for each linked tutor whose local time is Saturday ~8 AM and who hasn't been sent this week, calls the `send-telegram-recap` edge function via `pg_net`. That function gathers lessons + payments with supabase-js, computes the "expected" amount with a TypeScript port of the app's existing rate logic, formats a Telegram HTML message, and sends it. A `telegram_recap_log` table with a unique `(tutor_id, week_start)` constraint guarantees one send per week even if the cron re-runs. The same function powers a "Send preview now" button (preview sends skip the log).

**Tech Stack:** Supabase Postgres (migrations, plpgsql, pg_cron, pg_net, Vault), Deno edge functions (TypeScript), React Native / Expo Router, Telegram Bot API.

**Reference patterns in this repo:**
- pg_net + Vault call: `supabase/migrations/20260604215841_push_notification_trigger.sql`
- pg_cron scheduling: `supabase/migrations/20260129000002_scheduled_payment_reminders.sql`
- Edge function shape (CORS, service-role client, env vars): `supabase/functions/send-payment-reminder/index.ts`
- Amount logic to port: `calculateLessonAmountWithDetails` in `src/hooks/usePayments.ts:1320`
- Settings screen pattern: `app/notification-settings.tsx`
- More-menu registration: `app/(tabs)/more.tsx`
- Edge invoke from app: `supabase.functions.invoke(...)` e.g. `src/hooks/useParentInvitation.ts:35`

**Conventions:**
- New migrations only; never edit existing ones. Name: `npx supabase migration new <name>`. The plan uses placeholder filenames `supabase/migrations/<timestamp>_<name>.sql` — use the CLI-generated timestamp.
- Run `npm run typecheck` before any frontend commit.
- Secrets needed (set by the user, see Task 0): `TELEGRAM_BOT_TOKEN` (edge function secret); `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` (app `.env`); Vault `project_url` / `service_role_key` (already used by push — confirm set).

---

## File Structure

**Create:**
- `supabase/migrations/<ts>_telegram_recap_schema.sql` — columns on `parents`, `telegram_link_tokens`, `telegram_recap_log`, `create_telegram_link_token()` RPC.
- `supabase/migrations/<ts>_telegram_recap_schedule.sql` — `send_weekly_tutor_recaps()` + pg_cron job.
- `supabase/functions/telegram-webhook/index.ts` — bot webhook (`/start`, `/stop`).
- `supabase/functions/send-telegram-recap/index.ts` — build + send recap.
- `supabase/functions/send-telegram-recap/recap.ts` — pure helpers: `calculateLessonAmount`, `buildRecapMessage`, window math. (Pure → unit-testable.)
- `supabase/functions/send-telegram-recap/recap.test.ts` — Deno tests for the pure helpers.
- `src/hooks/useTutorTelegram.ts` — link status, mint token, send preview, disconnect, toggle.
- `app/telegram-recap.tsx` — tutor-only settings screen.
- `docs/telegram-bot-setup.md` — BotFather + secrets + webhook registration runbook.

**Modify:**
- `app/(tabs)/more.tsx` — add a tutor-only "Weekly Telegram Recap" menu item.
- `src/types/database.ts` — add the new `parents` columns and new table row types (keep in sync with existing hand-written types).

---

## Task 0: Telegram bot setup runbook (manual prerequisite, documented)

This task produces documentation the user follows once. Code tasks below do **not** depend on the bot existing until Task 8 (end-to-end test), so implementation can proceed in parallel.

**Files:**
- Create: `docs/telegram-bot-setup.md`

- [ ] **Step 1: Write the runbook**

Create `docs/telegram-bot-setup.md`:

````markdown
# Telegram Weekly Recap — Bot Setup Runbook

One-time setup to enable the weekly Telegram recap feature.

## 1. Create the bot
1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, follow prompts, choose a name and a username ending in `bot`
   (e.g. `Love2LearnRecapBot`).
3. BotFather returns an **HTTP API token** like `123456:ABC-DEF...`. Keep it secret.

## 2. Configure secrets
```bash
# Edge function secret (server-side; never shipped to the app)
npx supabase secrets set TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."

# Confirm the Vault secrets used by pg_net are present (already used by push):
#   project_url        = https://<project-ref>.supabase.co
#   service_role_key   = <service role key>
# Set/verify in Supabase Studio → Project Settings → Vault, or:
#   select name from vault.secrets where name in ('project_url','service_role_key');
```

Add the bot username (WITHOUT the `@`) to the app `.env`:
```env
EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=Love2LearnRecapBot
```

## 3. Register the webhook (after deploying the edge functions)
```bash
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy send-telegram-recap

# Point Telegram at the webhook. Use a secret path token to reject forged calls.
BOT=123456:ABC-DEF...
PROJECT_REF=<your-project-ref>
SECRET=<random-string-also-set-as-TELEGRAM_WEBHOOK_SECRET>
curl "https://api.telegram.org/bot$BOT/setWebhook" \
  -d "url=https://$PROJECT_REF.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=$SECRET"
```
> `telegram-webhook` is deployed with `--no-verify-jwt` because Telegram calls it
> directly without a Supabase JWT. It is protected instead by the
> `X-Telegram-Bot-Api-Secret-Token` header (set `TELEGRAM_WEBHOOK_SECRET` to the
> same `$SECRET`).

## 4. Enable pg_cron / pg_net (if not already)
In Supabase Studio → Database → Extensions, enable `pg_cron` and `pg_net`.

## 5. Verify
- In the app (as a tutor): More → Weekly Telegram Recap → Connect Telegram.
- The bot should reply "✅ Connected".
- Tap "Send preview now" — you should receive a recap message.
````

- [ ] **Step 2: Commit**

```bash
git add docs/telegram-bot-setup.md
git commit -m "docs(telegram-recap): add bot setup runbook"
```

---

## Task 1: Database schema — columns, tables, token RPC

**Files:**
- Create: `supabase/migrations/<ts>_telegram_recap_schema.sql`

- [ ] **Step 1: Generate the migration file**

Run: `npx supabase migration new telegram_recap_schema`
Expected: prints a new path under `supabase/migrations/`. Use that file below.

- [ ] **Step 2: Write the schema migration**

Paste into the new migration file:

```sql
-- Weekly Telegram recap: tutor linking + scheduling support tables.

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
  status text not null default 'sent', -- 'sent' | 'error'
  error text,
  unique (tutor_id, week_start)
);
create index if not exists idx_telegram_recap_log_tutor on telegram_recap_log(tutor_id);

-- 4. RLS: tutors read their own log/tokens; writes go through SECURITY DEFINER
--    functions and the service-role edge function, so no broad write policies.
alter table telegram_link_tokens enable row level security;
alter table telegram_recap_log enable row level security;

create policy "tutor reads own link tokens" on telegram_link_tokens
  for select using (tutor_id = get_current_user_parent());

create policy "tutor reads own recap log" on telegram_recap_log
  for select using (tutor_id = get_current_user_parent());

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
  v_tutor_id := get_current_user_parent();
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
```

> Note: `get_current_user_parent()` is the existing SECURITY DEFINER helper used
> throughout the RLS layer (see CLAUDE.md). Confirm its name with
> `grep -rn "get_current_user_parent" supabase/migrations | head` before applying;
> if the project uses a different helper, substitute it consistently here.

- [ ] **Step 3: Apply locally and verify**

Run: `npx supabase db reset`
Expected: completes without error; the migration runs in order.

Then verify the objects exist:
Run:
```bash
npx supabase db reset >/dev/null 2>&1 && \
echo "\d telegram_recap_log" | npx supabase db psql 2>/dev/null | grep -q "tutor_id, week_start" && echo "UNIQUE OK" || echo "check manually"
```
Expected: the `telegram_recap_log` table exists with a unique `(tutor_id, week_start)`.
(If `db psql` is unavailable in your setup, open Studio and confirm the three columns on `parents`, the two new tables, and the unique constraint.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*telegram_recap_schema.sql
git commit -m "feat(telegram-recap): schema for linking + send log + token RPC"
```

---

## Task 2: Pure recap helpers + tests (amount calc, window math, message)

This is the riskiest logic (rate math + drift risk), so it is isolated as pure
functions with Deno tests, written test-first.

**Files:**
- Create: `supabase/functions/send-telegram-recap/recap.ts`
- Test: `supabase/functions/send-telegram-recap/recap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/send-telegram-recap/recap.test.ts`:

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  calculateLessonAmount,
  weekWindowForSaturday,
  buildRecapMessage,
} from './recap.ts';

const settings = {
  default_rate: 45,
  default_base_duration: 60,
  subject_rates: {
    piano: { rate: 30, base_duration: 30, duration_prices: { '45': 50 } },
    math: { rate: 60, base_duration: 60 },
  },
  combined_session_rate: 0,
};

Deno.test('override wins over rates', () => {
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, 99), 99);
});

Deno.test('explicit duration tier price', () => {
  // piano has a 45-min tier priced at $50
  assertEquals(calculateLessonAmount(settings, 'piano', 45, false, null), 50);
});

Deno.test('base-duration scaling', () => {
  // piano 30/30min rate, 60min => 2 * 30 = 60
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
  // math 60/60min, 30min => 0.5 * 60 = 30
  assertEquals(calculateLessonAmount(settings, 'math', 30, false, null), 30);
});

Deno.test('falls back to default rate for unknown subject', () => {
  // english not in subject_rates => default 45/60min, 60min => 45
  assertEquals(calculateLessonAmount(settings, 'english', 60, false, null), 45);
});

Deno.test('weekWindowForSaturday returns Sun..Fri for the ending week', () => {
  // Saturday 2026-06-06 → window Sun 2026-05-31 .. Fri 2026-06-05
  const w = weekWindowForSaturday(new Date('2026-06-06T08:00:00'));
  assertEquals(w.weekStart, '2026-05-31');
  assertEquals(w.weekEndExclusive, '2026-06-06'); // [Sun 00:00, Sat 00:00)
});

Deno.test('buildRecapMessage shows quiet-week note', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'May 31–Jun 5',
    lessons: [],
    received: 0,
    outstanding: 0,
    expected: 0,
  });
  assertEquals(msg.includes('No classes scheduled'), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/send-telegram-recap/recap.test.ts`
Expected: FAIL — `recap.ts` does not exist / exports missing.

- [ ] **Step 3: Implement the pure helpers**

Create `supabase/functions/send-telegram-recap/recap.ts`:

```ts
// Pure, dependency-free helpers for the weekly recap. Unit-tested in recap.test.ts.
// calculateLessonAmount is a faithful port of calculateLessonAmountWithDetails
// in src/hooks/usePayments.ts — keep the two in sync (the tests pin the values).

export interface SubjectRateConfig {
  rate: number;
  base_duration: number;
  duration_prices?: Record<string, number>;
}
export interface TutorRateSettings {
  default_rate?: number | null;
  default_base_duration?: number | null;
  subject_rates?: Record<string, SubjectRateConfig> | null;
  combined_session_rate?: number | null;
}

export function calculateLessonAmount(
  settings: TutorRateSettings | null,
  subject: string,
  durationMin: number,
  _isCombinedSession: boolean,
  overrideAmount?: number | null,
): number {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount;
  }

  const subjectRates = settings?.subject_rates ?? undefined;
  let rate: number;
  let baseDuration: number;

  const rateConfig = subjectRates ? subjectRates[subject] : undefined;
  if (rateConfig && rateConfig.rate > 0 && rateConfig.base_duration > 0) {
    const durationPrices = rateConfig.duration_prices;
    if (durationPrices && typeof durationPrices === 'object') {
      const explicit = durationPrices[String(durationMin)];
      if (typeof explicit === 'number' && explicit > 0) {
        return explicit;
      }
    }
    rate = rateConfig.rate;
    baseDuration = rateConfig.base_duration;
  } else {
    rate = settings?.default_rate ?? defaultRate;
    baseDuration = settings?.default_base_duration ?? defaultBaseDuration;
  }

  return (durationMin / baseDuration) * rate;
}

// Given a local Saturday Date, return the Sun..Fri window of the week ending today.
// weekStart = the Sunday (date string), weekEndExclusive = the Saturday (date string).
// Window is [weekStart 00:00, weekEndExclusive 00:00) → covers Sun through Fri.
export function weekWindowForSaturday(localSaturday: Date): {
  weekStart: string;
  weekEndExclusive: string;
} {
  const sat = new Date(localSaturday);
  sat.setHours(0, 0, 0, 0);
  const sunday = new Date(sat);
  sunday.setDate(sat.getDate() - 6); // Sat - 6 = Sunday
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { weekStart: fmt(sunday), weekEndExclusive: fmt(sat) };
}

export interface RecapLesson {
  date: string;       // 'Mon Jun 1'
  studentName: string;
  subjectLabel: string;
  status: string;     // 'scheduled' | 'completed' | 'cancelled'
}

export interface RecapData {
  rangeLabel: string;
  lessons: RecapLesson[];
  received: number;
  outstanding: number;
  expected: number;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildRecapMessage(d: RecapData): string {
  const header = `📚 <b>Your week, ${escapeHtml(d.rangeLabel)}</b>`;

  if (d.lessons.length === 0 && d.received === 0 && d.outstanding === 0) {
    return `${header}\n\nNo classes scheduled this week 🌿\nEnjoy the quiet — see you next week!`;
  }

  const statusMark: Record<string, string> = {
    completed: '✅',
    cancelled: '❌',
    scheduled: '•',
  };
  const lessonLines = d.lessons.length
    ? d.lessons
        .map(
          (l) =>
            `${statusMark[l.status] ?? '•'} ${escapeHtml(l.date)} — ${escapeHtml(
              l.studentName,
            )} · ${escapeHtml(l.subjectLabel)}`,
        )
        .join('\n')
    : '<i>No classes this week.</i>';

  return [
    header,
    '',
    `<b>Classes (${d.lessons.length})</b>`,
    lessonLines,
    '',
    '<b>Payments</b>',
    `💰 Received this week: ${money(d.received)}`,
    `⏳ Outstanding / overdue: ${money(d.outstanding)}`,
    `📈 Expected from this week's classes: ${money(d.expected)}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/send-telegram-recap/recap.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-telegram-recap/recap.ts supabase/functions/send-telegram-recap/recap.test.ts
git commit -m "feat(telegram-recap): pure recap helpers (amount calc, window, message) + tests"
```

---

## Task 3: `send-telegram-recap` edge function

**Files:**
- Create: `supabase/functions/send-telegram-recap/index.ts`

- [ ] **Step 1: Implement the function**

Create `supabase/functions/send-telegram-recap/index.ts`:

```ts
/**
 * Edge Function: Send Weekly Telegram Recap
 *
 * Invoked two ways:
 *  - Scheduled: pg_net from send_weekly_tutor_recaps() with { tutor_id, week_start }.
 *  - Preview: app via functions.invoke with { tutor_id, preview: true }.
 *
 * Gathers the tutor's classes (Sun–Fri) and payments, formats a Telegram message,
 * and sends it. Scheduled sends are logged for idempotency; previews are not.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  calculateLessonAmount,
  buildRecapMessage,
  type RecapLesson,
} from './recap.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-name',
};

const SUBJECT_LABELS: Record<string, string> = {
  piano: '🎹 Piano',
  math: '📐 Math',
  reading: '📖 Reading',
  speech: '🗣️ Speech',
  english: '📝 English',
};
const subjectLabel = (s: string) =>
  SUBJECT_LABELS[s] ?? `📚 ${s.charAt(0).toUpperCase()}${s.slice(1)}`;

interface RecapRequest {
  tutor_id: string;
  week_start?: string;        // 'YYYY-MM-DD' Sunday; required for scheduled sends
  preview?: boolean;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase env not configured');
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

    const { tutor_id, week_start, preview = false }: RecapRequest = await req.json();
    if (!tutor_id) {
      return json({ error: 'tutor_id is required' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Tutor + link status + rates.
    const { data: tutor, error: tutorErr } = await supabase
      .from('parents')
      .select('id, telegram_chat_id, telegram_recap_enabled, timezone')
      .eq('id', tutor_id)
      .single();
    if (tutorErr || !tutor) return json({ error: 'Tutor not found' }, 404);

    if (!tutor.telegram_chat_id || tutor.telegram_recap_enabled === false) {
      return json({ success: true, skipped: true, reason: 'not linked or disabled' }, 200);
    }

    const { data: settings } = await supabase
      .from('tutor_settings')
      .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
      .eq('tutor_id', tutor_id)
      .maybeSingle();

    // 2. Resolve the Sun..Fri window.
    //    Scheduled: week_start (Sunday) is passed in.
    //    Preview: compute from "now" in the tutor's timezone.
    const { weekStartDate, weekEndExclusive, rangeLabel } = resolveWindow(
      week_start,
      tutor.timezone || 'America/Los_Angeles',
    );

    // 3. Classes in window (all statuses), joined to students.
    const { data: lessonRows } = await supabase
      .from('scheduled_lessons')
      .select('id, subject, scheduled_at, duration_min, status, override_amount, student:students!inner(name)')
      .eq('tutor_id', tutor_id)
      .gte('scheduled_at', `${weekStartDate}T00:00:00`)
      .lt('scheduled_at', `${weekEndExclusive}T00:00:00`)
      .order('scheduled_at', { ascending: true });

    const lessons: RecapLesson[] = (lessonRows ?? []).map((l: any) => ({
      date: new Date(l.scheduled_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      studentName: l.student?.name ?? 'Student',
      subjectLabel: subjectLabel(l.subject),
      status: l.status,
    }));

    const expected = (lessonRows ?? []).reduce(
      (sum: number, l: any) =>
        sum +
        calculateLessonAmount(
          settings ?? null,
          l.subject,
          l.duration_min,
          false,
          l.override_amount,
        ),
      0,
    );

    // 4. Payments received in window (paid_at in range).
    const { data: receivedRows } = await supabase
      .from('payments')
      .select('amount_paid, paid_at')
      .eq('tutor_id', tutor_id)
      .gte('paid_at', `${weekStartDate}T00:00:00`)
      .lt('paid_at', `${weekEndExclusive}T00:00:00`);
    const received = (receivedRows ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount_paid ?? 0),
      0,
    );

    // 5. Outstanding / overdue across all the tutor's payments.
    const { data: outstandingRows } = await supabase
      .from('payments')
      .select('amount_due, amount_paid, status')
      .eq('tutor_id', tutor_id)
      .in('status', ['unpaid', 'partial']);
    const outstanding = (outstandingRows ?? []).reduce(
      (s: number, p: any) => s + (Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)),
      0,
    );

    // 6. Build + send.
    const text = buildRecapMessage({ rangeLabel, lessons, received, outstanding, expected });

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tutor.telegram_chat_id,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const tgOk = tgRes.ok;
    const tgBody = await tgRes.json().catch(() => ({}));

    // 7. Log scheduled sends for idempotency (skip for previews).
    if (!preview) {
      await supabase
        .from('telegram_recap_log')
        .upsert(
          {
            tutor_id,
            week_start: weekStartDate,
            status: tgOk ? 'sent' : 'error',
            error: tgOk ? null : JSON.stringify(tgBody).slice(0, 500),
            sent_at: new Date().toISOString(),
          },
          { onConflict: 'tutor_id,week_start' },
        );
    }

    if (!tgOk) {
      return json({ error: 'Telegram send failed', details: tgBody }, 502);
    }
    return json({ success: true, preview, week_start: weekStartDate }, 200);
  } catch (error) {
    console.error('send-telegram-recap error:', error);
    return json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Resolve the Sun..Fri window. If weekStart (Sunday) is provided, use it.
// Otherwise compute from current date in the tutor's timezone (preview path).
function resolveWindow(
  weekStart: string | undefined,
  timeZone: string,
): { weekStartDate: string; weekEndExclusive: string; rangeLabel: string } {
  let sunday: Date;
  if (weekStart) {
    sunday = new Date(`${weekStart}T00:00:00`);
  } else {
    // "Today" in the tutor's tz → back up to the most recent Sunday.
    const nowLocal = new Date(
      new Date().toLocaleString('en-US', { timeZone }),
    );
    nowLocal.setHours(0, 0, 0, 0);
    sunday = new Date(nowLocal);
    sunday.setDate(nowLocal.getDate() - nowLocal.getDay()); // getDay(): 0 = Sunday
  }
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6); // exclusive end (covers Sun..Fri)
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 5);

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const fmtLabel = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return {
    weekStartDate: fmtDate(sunday),
    weekEndExclusive: fmtDate(saturday),
    rangeLabel: `${fmtLabel(sunday)}–${fmtLabel(friday)}`,
  };
}
```

> Verify column names against the schema before finishing: `payments.paid_at`,
> `payments.amount_paid`, `payments.amount_due`, `payments.status`
> (`unpaid|partial|paid`), `scheduled_lessons.tutor_id`, `.status`,
> `.override_amount`, `.duration_min`, `.scheduled_at`, `.subject`. These were
> confirmed from `src/types/database.ts` and existing migrations; if a name
> differs, fix it here.

- [ ] **Step 2: Type-check the function with Deno**

Run: `deno check supabase/functions/send-telegram-recap/index.ts`
Expected: no errors. (Re-run `deno test supabase/functions/send-telegram-recap/recap.test.ts` — still PASS.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-telegram-recap/index.ts
git commit -m "feat(telegram-recap): send-telegram-recap edge function"
```

---

## Task 4: `telegram-webhook` edge function (linking)

**Files:**
- Create: `supabase/functions/telegram-webhook/index.ts`

- [ ] **Step 1: Implement the webhook**

Create `supabase/functions/telegram-webhook/index.ts`:

```ts
/**
 * Edge Function: Telegram Webhook
 *
 * Telegram calls this directly (deploy with --no-verify-jwt). Protected by the
 * X-Telegram-Bot-Api-Secret-Token header matching TELEGRAM_WEBHOOK_SECRET.
 *
 * Handles:
 *  - /start <token>  → validate one-time token, link chat to the tutor.
 *  - /stop           → unlink the chat from any tutor.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async (req: Request) => {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!botToken || !supabaseUrl || !serviceKey) {
      return new Response('not configured', { status: 500 });
    }

    // Reject forged calls.
    if (
      webhookSecret &&
      req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== webhookSecret
    ) {
      return new Response('forbidden', { status: 403 });
    }

    const update = await req.json();
    const message = update.message ?? update.edited_message;
    const chatId: number | undefined = message?.chat?.id;
    const text: string = message?.text ?? '';
    const username: string | null = message?.from?.username ?? null;

    if (!chatId) return new Response('ok'); // ignore non-message updates

    const supabase = createClient(supabaseUrl, serviceKey);
    const reply = (t: string) => sendTelegram(botToken, chatId, t);

    if (text.startsWith('/start')) {
      const token = text.split(' ')[1]?.trim();
      if (!token) {
        await reply('👋 To connect, open the "Connect Telegram" button in the app.');
        return new Response('ok');
      }

      const { data: row } = await supabase
        .from('telegram_link_tokens')
        .select('tutor_id, used_at, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
        await reply('⚠️ This link is invalid or expired. Please tap "Connect Telegram" in the app again.');
        return new Response('ok');
      }

      await supabase
        .from('parents')
        .update({
          telegram_chat_id: String(chatId),
          telegram_username: username,
          telegram_linked_at: new Date().toISOString(),
          telegram_recap_enabled: true,
        })
        .eq('id', row.tutor_id);

      await supabase
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      await reply('✅ Connected! You\'ll get your weekly class & payment recap here every Saturday morning.');
      return new Response('ok');
    }

    if (text.startsWith('/stop')) {
      await supabase
        .from('parents')
        .update({ telegram_chat_id: null, telegram_linked_at: null })
        .eq('telegram_chat_id', String(chatId));
      await reply('🔕 Disconnected. You won\'t receive weekly recaps. Reconnect anytime from the app.');
      return new Response('ok');
    }

    await reply('I send weekly recaps 📚. Use the app to connect, or /stop to disconnect.');
    return new Response('ok');
  } catch (error) {
    console.error('telegram-webhook error:', error);
    // Always 200 so Telegram doesn't hammer retries on our bugs.
    return new Response('ok');
  }
});

async function sendTelegram(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `deno check supabase/functions/telegram-webhook/index.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/telegram-webhook/index.ts
git commit -m "feat(telegram-recap): telegram-webhook for /start linking and /stop"
```

---

## Task 5: Scheduling function + pg_cron

**Files:**
- Create: `supabase/migrations/<ts>_telegram_recap_schedule.sql`

- [ ] **Step 1: Generate the migration**

Run: `npx supabase migration new telegram_recap_schedule`
Expected: prints a new path. Use it below.

- [ ] **Step 2: Write the scheduling migration**

```sql
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
  v_local timestamptz;
  v_week_start date;
  v_count integer := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'Vault secrets missing; skipping telegram recap dispatch';
    return 0;
  end if;

  for v_tutor in
    select id, coalesce(timezone, 'America/Los_Angeles') as tz
    from parents
    where telegram_chat_id is not null
      and telegram_recap_enabled = true
      and role = 'tutor'
  loop
    -- Current time in the tutor's timezone.
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
    perform cron.unschedule('telegram-weekly-recaps');
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
```

> `cron.unschedule('telegram-weekly-recaps')` raises if the job doesn't exist on
> first run. The surrounding `exception when others` block swallows it, matching
> the existing payment-reminder migration's tolerance. If you prefer, guard with
> `if exists (select 1 from cron.job where jobname = 'telegram-weekly-recaps')`.

- [ ] **Step 3: Apply and smoke-test the function**

Run: `npx supabase db reset`
Expected: completes; notice about cron scheduled or pg_cron not available.

Then call it manually (no linked tutors → returns 0, no error):
Run: `echo "select send_weekly_tutor_recaps();" | npx supabase db psql 2>/dev/null || echo "run in Studio"`
Expected: returns `0` (nothing dispatched).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*telegram_recap_schedule.sql
git commit -m "feat(telegram-recap): hourly pg_cron dispatch with per-timezone Saturday gating"
```

---

## Task 6: `useTutorTelegram` hook

**Files:**
- Create: `src/hooks/useTutorTelegram.ts`
- Modify: `src/types/database.ts` (add new `parents` columns + table types)

- [ ] **Step 1: Add types to `src/types/database.ts`**

Find the `parents` row type (the hand-written interface — search for existing
fields like `telegram` is absent; locate the `parents` Row near `subscription_status`).
Add these fields to the `parents` Row/Insert/Update interfaces (Insert/Update as optional):

```ts
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_linked_at: string | null;
  telegram_recap_enabled: boolean;
```

> If `src/types/database.ts` is generated rather than hand-written, instead add a
> minimal local interface in the hook file and cast, to avoid fighting codegen.
> Check the file header for a "generated" banner first.

- [ ] **Step 2: Implement the hook**

Create `src/hooks/useTutorTelegram.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

export interface TelegramStatus {
  linked: boolean;
  username: string | null;
  enabled: boolean;
}

const BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';

export function useTutorTelegram() {
  const { parent } = useAuthContext();
  const tutorId = parent?.id ?? null;

  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!tutorId) return;
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from('parents')
        .select('telegram_chat_id, telegram_username, telegram_recap_enabled')
        .eq('id', tutorId)
        .single();
      if (qErr) throw qErr;
      setStatus({
        linked: !!data?.telegram_chat_id,
        username: data?.telegram_username ?? null,
        enabled: data?.telegram_recap_enabled ?? true,
      });
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Mint a one-time token and return the t.me deep link.
  const getLinkUrl = useCallback(async (): Promise<string> => {
    const { data, error: rpcErr } = await supabase.rpc('create_telegram_link_token');
    if (rpcErr) throw rpcErr;
    if (!BOT_USERNAME) {
      throw new Error('EXPO_PUBLIC_TELEGRAM_BOT_USERNAME is not set');
    }
    return `https://t.me/${BOT_USERNAME}?start=${data}`;
  }, []);

  const sendPreview = useCallback(async () => {
    if (!tutorId) throw new Error('No tutor');
    const { data, error: invErr } = await supabase.functions.invoke('send-telegram-recap', {
      body: { tutor_id: tutorId, preview: true },
    });
    if (invErr) throw invErr;
    return data;
  }, [tutorId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!tutorId) return;
      const { error: upErr } = await supabase
        .from('parents')
        .update({ telegram_recap_enabled: enabled })
        .eq('id', tutorId);
      if (upErr) throw upErr;
      await refetch();
    },
    [tutorId, refetch],
  );

  const disconnect = useCallback(async () => {
    if (!tutorId) return;
    const { error: upErr } = await supabase
      .from('parents')
      .update({ telegram_chat_id: null, telegram_username: null, telegram_linked_at: null })
      .eq('id', tutorId);
    if (upErr) throw upErr;
    await refetch();
  }, [tutorId, refetch]);

  return { status, loading, error, refetch, getLinkUrl, sendPreview, setEnabled, disconnect };
}
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: no errors. (Confirm `@lib/supabase` and `../contexts/AuthContext`
import paths match the repo — adjust if the alias differs.)

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTutorTelegram.ts src/types/database.ts
git commit -m "feat(telegram-recap): useTutorTelegram hook (link, preview, toggle, disconnect)"
```

---

## Task 7: Settings screen + More-menu entry

**Files:**
- Create: `app/telegram-recap.tsx`
- Modify: `app/(tabs)/more.tsx`

- [ ] **Step 1: Add the More-menu item**

In `app/(tabs)/more.tsx`, add to the `menuItems` array (place it just before the
`notifications-settings` item):

```ts
  {
    key: 'telegram-recap',
    label: 'Weekly Telegram Recap',
    icon: 'paper-plane',
    href: '/telegram-recap',
    description: 'Get your weekly class & payment summary on Telegram',
    tutorOnly: true,
  },
```

- [ ] **Step 2: Create the screen**

Create `app/telegram-recap.tsx`:

```tsx
/**
 * Weekly Telegram Recap settings (tutor-only).
 * Connect/disconnect Telegram, toggle the recap, and send a preview.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Switch, Linking, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTutorTelegram } from '../src/hooks/useTutorTelegram';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

export default function TelegramRecapScreen() {
  const { status, loading, getLinkUrl, sendPreview, setEnabled, disconnect } = useTutorTelegram();
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const url = await getLinkUrl();
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Could not start linking', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    try {
      await sendPreview();
      Alert.alert('Sent', 'A preview recap was sent to your Telegram.');
    } catch (e) {
      Alert.alert('Could not send preview', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Telegram?', 'You will stop receiving weekly recaps.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await disconnect();
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary.main} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="paper-plane" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.rowTitle}>Weekly Telegram Recap</Text>
          <Text style={styles.rowDescription}>
            Every Saturday morning, get last week&apos;s classes (Sun–Fri) and a
            payment summary delivered to Telegram.
          </Text>
        </View>
      </View>

      {!status?.linked ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={handleConnect}
          disabled={busy}
        >
          <Ionicons name="link" size={18} color={colors.neutral.white} />
          <Text style={styles.primaryBtnText}>{busy ? 'Opening…' : 'Connect Telegram'}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.textContainer}>
              <Text style={styles.rowTitle}>Connected</Text>
              <Text style={styles.rowDescription}>
                {status.username ? `@${status.username}` : 'Your Telegram is linked.'}
              </Text>
            </View>
            <Switch
              value={status.enabled}
              onValueChange={(v) => setEnabled(v)}
              trackColor={{ false: colors.neutral.border, true: colors.primary.main }}
              thumbColor={colors.neutral.white}
              ios_backgroundColor={colors.neutral.border}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={handlePreview}
            disabled={busy}
          >
            <Ionicons name="send" size={18} color={colors.primary.main} />
            <Text style={styles.secondaryBtnText}>Send preview now</Text>
          </Pressable>

          <Pressable onPress={handleDisconnect} disabled={busy} style={styles.disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background, padding: spacing.lg },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  textContainer: { flex: 1, marginRight: spacing.md },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  rowDescription: { fontSize: typography.sizes.sm, color: colors.neutral.textSecondary, lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  primaryBtnText: { color: colors.neutral.white, fontWeight: typography.weights.semibold, fontSize: typography.sizes.md },
  secondaryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  secondaryBtnText: { color: colors.primary.main, fontWeight: typography.weights.semibold, fontSize: typography.sizes.md },
  pressed: { opacity: 0.85 },
  disconnect: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  disconnectText: { color: colors.accent?.coral ?? '#FF6B6B', fontWeight: typography.weights.medium },
});
```

> Verify theme tokens (`colors.primary.subtle`, `colors.accent.coral`,
> `typography.weights.medium`, `shadows.sm`) exist — they are used by
> `notification-settings.tsx` and `more.tsx`. If `colors.accent.coral` differs,
> use the theme's coral token from `src/theme/index.ts`.

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke (web)**

Run: `npm run web`
Then: log in as a tutor → More → "Weekly Telegram Recap" → screen renders with a
"Connect Telegram" button (tapping it requires the bot/env from Task 0, tested in Task 8).
Expected: screen renders without runtime errors.

- [ ] **Step 5: Commit**

```bash
git add app/telegram-recap.tsx "app/(tabs)/more.tsx"
git commit -m "feat(telegram-recap): tutor settings screen + More menu entry"
```

---

## Task 8: End-to-end verification (requires bot from Task 0)

This task is manual and depends on the user completing Task 0 and deploying the
functions. No code; it validates the full path.

- [ ] **Step 1: Deploy**

```bash
npx supabase db push
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy send-telegram-recap
```
Then register the webhook per `docs/telegram-bot-setup.md` §3.

- [ ] **Step 2: Link flow**

In the app (tutor): More → Weekly Telegram Recap → Connect Telegram → completes in
Telegram → bot replies "✅ Connected".
Verify: `select telegram_chat_id, telegram_username from parents where id = '<tutor>';` is populated.

- [ ] **Step 3: Token safety**

Re-open the same deep link (now used) → bot replies "invalid or expired".
Expected: no second link; `used_at` is set.

- [ ] **Step 4: Preview send**

Tap "Send preview now" → recap arrives in Telegram with classes + payments (or the
quiet-week note). Verify NO row was written to `telegram_recap_log` (preview skips logging).

- [ ] **Step 5: Idempotent scheduled send**

Simulate a scheduled send for the current week twice:
```sql
select net.http_post(...);  -- or invoke send-telegram-recap with { tutor_id, week_start:'<this Sunday>' }
```
Run the invoke twice. Expected: message arrives; `telegram_recap_log` has exactly
one row for `(tutor_id, week_start)` (the upsert dedups). Then run
`select send_weekly_tutor_recaps();` — returns 0 dispatches for an already-logged week.

- [ ] **Step 6: Disable + disconnect**

Toggle off → `select telegram_recap_enabled` is false → invoking the function
returns `{ skipped: true }`. Disconnect → `telegram_chat_id` is null.

- [ ] **Step 7: Commit any fixes found during E2E**

```bash
git add -A && git commit -m "fix(telegram-recap): address issues found in end-to-end testing"
```

---

## Self-Review Notes (coverage map)

- Spec §"Database changes" → Task 1 (columns, tokens, log, RPC).
- Spec §`send_weekly_tutor_recaps` + cron → Task 5.
- Spec §`telegram-webhook` → Task 4.
- Spec §`send-telegram-recap` + amount port → Tasks 2 (pure + tests) & 3 (function).
- Spec §Bot setup → Task 0 runbook.
- Spec §Frontend (hook + screen) → Tasks 6 & 7.
- Spec §Recap content + quiet week → Task 2 `buildRecapMessage` (+ test).
- Spec §Error handling (forged webhook, send failure logging, unset secrets, disabled tutor) → Tasks 3, 4, 5.
- Spec §Testing (window boundaries, amount calc, idempotency, timezone) → Tasks 2 & 8.
- Spec §Resolved (TS amount port, route placement, UUID token) → Tasks 2/3, 7, 1.
```
