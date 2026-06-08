# Auto-complete & Auto-pay Lessons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically mark each finished lesson as completed + paid at the tutor's end of day, so tutors only intervene for exceptions (unpaid / cancelled).

**Architecture:** A nightly per-tutor job replays the app's existing "Complete & Mark as Paid" behavior server-side. A `pg_cron` SQL dispatcher (`auto_complete_due_lessons()`) runs hourly, gates on the tutor's local 23:00 + a new `parents.auto_complete_lessons` toggle, and POSTs `{tutor_id}` to a new `auto-complete-lessons` Edge Function (same pattern as the existing telegram-recap cron). The function completes due lessons (porting `useCompleteLesson`'s prepaid logic) and, for invoice subjects, generates + settles the monthly invoice (porting `useQuickInvoice` + `useMarkPaymentPaid`). "Paid" reuses the existing `payment_lessons.paid` / `payments.status` — no new paid column.

**Tech Stack:** Supabase (Postgres, pg_cron, pg_net, Vault, Edge Functions/Deno), React Native + Expo, TypeScript. Spec: `docs/superpowers/specs/2026-06-07-auto-complete-lessons-design.md`.

**Reference reading before starting:**
- `app/(tabs)/calendar.tsx:602-716` — `handleCompleteLesson` / `handleCompleteLessonAndPay` (the behavior we automate)
- `src/hooks/useLessons.ts:606-718` — `useCompleteLesson` (prepaid increment to port)
- `src/hooks/usePayments.ts:1795-2009` — `useQuickInvoice` (invoice port); `:385-447` — `useMarkPaymentPaid`
- `supabase/functions/send-telegram-recap/index.ts` + `recap.ts` — Edge Function + cron pattern to mirror
- `supabase/migrations/20260608005154_telegram_recap_schedule.sql` — dispatcher + cron pattern to mirror

**Conventions:**
- Never edit existing migrations — always `npx supabase migration new <name>`.
- Run all commands from repo root `/Users/huybuilds/repos/love2learn-tutoring-app`.
- Branch already in use: `feature/auto-complete-lessons`.

---

## Task 1: Migration — toggle column + auto_completed_at stamp

**Files:**
- Create: `supabase/migrations/<timestamp>_auto_complete_lessons_columns.sql`

- [ ] **Step 1: Create the migration file**

Run:
```bash
npx supabase migration new auto_complete_lessons_columns
```
Expected: prints the new file path under `supabase/migrations/`.

- [ ] **Step 2: Write the migration**

Put this in the new file:
```sql
-- Auto-complete & auto-pay lessons: per-tutor toggle + auto-mark audit stamp.

-- Per-tutor opt-out. Default ON: every tutor gets the automation immediately.
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS auto_complete_lessons BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN parents.auto_complete_lessons IS
  'Tutor setting: when true, finished lessons are auto-marked completed + paid at end of day.';

-- Set when the nightly job auto-marks a lesson. Distinguishes auto from manual
-- completion (used by the weekly recap). NOT used for idempotency (status is).
ALTER TABLE scheduled_lessons
  ADD COLUMN IF NOT EXISTS auto_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN scheduled_lessons.auto_completed_at IS
  'Timestamp the auto-complete job marked this lesson completed; NULL for manual completion.';
```

- [ ] **Step 3: Apply locally and verify**

Run:
```bash
npx supabase db reset
```
Expected: reset completes without error; the new migration runs last.

- [ ] **Step 4: Verify columns exist**

Run:
```bash
npx supabase db reset >/dev/null 2>&1; psql "$(npx supabase status -o env 2>/dev/null | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "\d+ parents" -c "\d+ scheduled_lessons" | grep -E "auto_complete_lessons|auto_completed_at"
```
Expected: both columns listed. (If `psql`/local DB isn't available, instead confirm via the Supabase Studio table view that the columns appear.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_auto_complete_lessons_columns.sql
git commit -m "feat(auto-complete): add auto_complete_lessons toggle and auto_completed_at columns"
```

---

## Task 2: Extract shared lesson-amount helper for Edge Functions

Relocate `calculateLessonAmount` so the new function and the recap share one copy.

**Files:**
- Create: `supabase/functions/_shared/lessonAmount.ts`
- Create: `supabase/functions/_shared/lessonAmount.test.ts`
- Modify: `supabase/functions/send-telegram-recap/recap.ts` (re-export instead of own copy)

- [ ] **Step 1: Create the shared module**

Create `supabase/functions/_shared/lessonAmount.ts` (this is the exact body currently in `recap.ts:1-52`):
```ts
// Pure, dependency-free lesson-amount math shared by Edge Functions.
// Faithful port of calculateLessonAmountWithDetails in src/hooks/usePayments.ts —
// keep in sync (lessonAmount.test.ts pins the values). Combined-session pricing
// intentionally uses the same duration-based rate as single sessions (the source
// function ignores isCombinedSession for the amount).

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
```

- [ ] **Step 2: Write the failing test**

Create `supabase/functions/_shared/lessonAmount.test.ts`:
```ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { calculateLessonAmount } from './lessonAmount.ts';

Deno.test('default rate when no settings', () => {
  assertEquals(calculateLessonAmount(null, 'math', 60, false, null), 45);
});

Deno.test('override wins', () => {
  assertEquals(calculateLessonAmount(null, 'math', 30, false, 12.5), 12.5);
});

Deno.test('subject rate, pro-rated by duration', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 30, false, null), 30);
});

Deno.test('explicit duration tier price', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60, duration_prices: { '45': 50 } } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 45, false, null), 50);
});

Deno.test('combined session uses same amount as single (flag ignored)', () => {
  const settings = { subject_rates: { math: { rate: 60, base_duration: 60 } } };
  assertEquals(
    calculateLessonAmount(settings, 'math', 60, true, null),
    calculateLessonAmount(settings, 'math', 60, false, null),
  );
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run:
```bash
deno test supabase/functions/_shared/lessonAmount.test.ts
```
Expected: 5 passed. (If `deno` is not installed: `brew install deno`, then re-run.)

- [ ] **Step 4: Make recap.ts re-export the shared copy**

In `supabase/functions/send-telegram-recap/recap.ts`, delete the local `SubjectRateConfig`/`TutorRateSettings` interfaces and the `calculateLessonAmount` function (lines 1-52), and replace with a re-export at the top of the file:
```ts
// Lesson-amount math is shared with other Edge Functions.
export {
  calculateLessonAmount,
  type SubjectRateConfig,
  type TutorRateSettings,
} from '../_shared/lessonAmount.ts';
```
Leave the rest of `recap.ts` (the `weekWindowForSaturday`, `localDateStartToUtcISO`, `buildRecapMessage`, etc.) unchanged.

- [ ] **Step 5: Verify recap tests still pass**

Run:
```bash
deno test supabase/functions/send-telegram-recap/recap.test.ts
```
Expected: all existing recap tests pass (the re-export is value-identical).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/lessonAmount.ts supabase/functions/_shared/lessonAmount.test.ts supabase/functions/send-telegram-recap/recap.ts
git commit -m "refactor(functions): extract shared calculateLessonAmount into _shared"
```

---

## Task 3: Edge Function pure helpers (dueLessons, isSubjectPrepaid)

**Files:**
- Create: `supabase/functions/auto-complete-lessons/autocomplete.ts`
- Create: `supabase/functions/auto-complete-lessons/autocomplete.test.ts`

- [ ] **Step 1: Write the failing test**

Create `supabase/functions/auto-complete-lessons/autocomplete.test.ts`:
```ts
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { dueLessons, isSubjectPrepaid } from './autocomplete.ts';

const NOW = Date.UTC(2026, 5, 7, 18, 0, 0); // 2026-06-07T18:00:00Z
const MAX_AGE = 7;

Deno.test('dueLessons keeps lessons whose end time has passed', () => {
  const rows = [
    { id: 'a', scheduled_at: '2026-06-07T16:00:00Z', duration_min: 60 }, // ends 17:00 -> due
    { id: 'b', scheduled_at: '2026-06-07T17:30:00Z', duration_min: 60 }, // ends 18:30 -> not due
    { id: 'c', scheduled_at: '2026-06-07T17:00:00Z', duration_min: 60 }, // ends 18:00 == now -> due
  ];
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['a', 'c']);
});

Deno.test('dueLessons handles empty/zero duration', () => {
  assertEquals(dueLessons([] as any, NOW, MAX_AGE), []);
  const rows = [{ id: 'z', scheduled_at: '2026-06-07T18:00:00Z', duration_min: 0 }]; // ends now -> due
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['z']);
});

Deno.test('dueLessons excludes lessons older than the look-back window', () => {
  const rows = [
    { id: 'old', scheduled_at: '2026-05-20T16:00:00Z', duration_min: 60 }, // ~18 days ago -> excluded
    { id: 'edge', scheduled_at: '2026-05-31T18:00:00Z', duration_min: 60 }, // exactly 7 days before now -> kept
    { id: 'recent', scheduled_at: '2026-06-06T16:00:00Z', duration_min: 60 }, // 1 day ago -> kept
  ];
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['edge', 'recent']);
});

Deno.test('isSubjectPrepaid: fully-prepaid family (no subject list) -> any subject prepaid', () => {
  assertEquals(isSubjectPrepaid('prepaid', [], 'math'), true);
});

Deno.test('isSubjectPrepaid: hybrid -> only listed subjects prepaid', () => {
  assertEquals(isSubjectPrepaid('prepaid', ['piano'], 'piano'), true);
  assertEquals(isSubjectPrepaid('prepaid', ['piano'], 'math'), false);
});

Deno.test('isSubjectPrepaid: invoice family -> never prepaid', () => {
  assertEquals(isSubjectPrepaid('invoice', [], 'math'), false);
  assertEquals(isSubjectPrepaid('invoice', ['piano'], 'piano'), true); // listed subject still prepaid
});
```

> Note the last case: `prepaid_subjects` listing a subject makes it prepaid regardless of `billing_mode`, matching `handleCompleteLessonAndPay` (`calendar.tsx:690-691`) which treats a subject as prepaid if it's in the list OR the family is fully prepaid.

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
deno test supabase/functions/auto-complete-lessons/autocomplete.test.ts
```
Expected: FAIL — "Module not found" / `autocomplete.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/auto-complete-lessons/autocomplete.ts`:
```ts
// Pure, dependency-free helpers for the auto-complete job. Unit-tested in
// autocomplete.test.ts so the time/billing logic is verifiable without a DB.

export interface CandidateLesson {
  id: string;
  subject: string;
  scheduled_at: string;
  duration_min: number;
  session_id: string | null;
  override_amount: number | null;
  student?: {
    id: string;
    parent_id: string;
    parent?: {
      id: string;
      billing_mode: string;
      prepaid_subjects: string[] | null;
    } | null;
  } | null;
}

// Keep only lessons whose end time (scheduled_at + duration) is at or before now,
// AND that started within the look-back window (started no more than maxAgeDays
// ago). The window bounds how far back the job will sweep stale scheduled lessons.
export function dueLessons(
  rows: CandidateLesson[],
  nowMs: number,
  maxAgeDays: number,
): CandidateLesson[] {
  const oldestMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
  return (rows ?? []).filter((l) => {
    const start = new Date(l.scheduled_at).getTime();
    const end = start + (Number(l.duration_min) || 0) * 60_000;
    return end <= nowMs && start >= oldestMs;
  });
}

// A subject is prepaid if the family is fully prepaid (prepaid mode + no subject
// list) or the subject is explicitly listed. Mirrors calendar.tsx:690-691.
export function isSubjectPrepaid(
  billingMode: string | null | undefined,
  prepaidSubjects: string[] | null | undefined,
  subject: string,
): boolean {
  const lower = (prepaidSubjects ?? []).map((s) => s.toLowerCase());
  const fullyPrepaid = billingMode === 'prepaid' && lower.length === 0;
  return fullyPrepaid || lower.includes((subject ?? '').toLowerCase());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
deno test supabase/functions/auto-complete-lessons/autocomplete.test.ts
```
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/auto-complete-lessons/autocomplete.ts supabase/functions/auto-complete-lessons/autocomplete.test.ts
git commit -m "feat(auto-complete): pure helpers dueLessons + isSubjectPrepaid (with look-back window)"
```

---

## Task 4: Edge Function `auto-complete-lessons` (handler + processing)

Ports `useCompleteLesson` (prepaid increment), `useQuickInvoice`, and `useMarkPaymentPaid` to the server, reusing the shared helpers.

**Files:**
- Create: `supabase/functions/auto-complete-lessons/index.ts`

- [ ] **Step 1: Write the function**

Create `supabase/functions/auto-complete-lessons/index.ts`:
```ts
/**
 * Edge Function: Auto-complete & auto-pay finished lessons for one tutor.
 *
 * Invoked two ways (same shape as send-telegram-recap):
 *  - Scheduled: pg_net from auto_complete_due_lessons() with { tutor_id }, using
 *    the service-role key as the bearer (isInternal -> trust the body).
 *  - "Run now": app via functions.invoke (user JWT) -> forced to the caller's own
 *    tutor_id.
 *
 * For each due `scheduled` lesson (end time passed) it replays the app's
 * "Complete & Mark as Paid" behavior: completes the lesson (+ prepaid session
 * increment), and for invoice subjects generates/extends the month's invoice and
 * marks it paid (the sync trigger then flips payment_lessons.paid).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { calculateLessonAmount } from '../_shared/lessonAmount.ts';
import { dueLessons, isSubjectPrepaid, type CandidateLesson } from './autocomplete.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name',
};

// Only sweep lessons that started within this many days. Bounds the backlog the
// job will auto-complete when the toggle is first enabled; self-heal for missed
// cron runs still works for up to this many days.
const MAX_LESSON_AGE_DAYS = 7;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase env not configured');

    const body = await req.json().catch(() => ({}));
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization') ?? '';
    const isInternal = authHeader === `Bearer ${serviceKey}`;

    let effectiveTutorId: string;
    if (isInternal) {
      if (!body.tutor_id) return json({ error: 'tutor_id is required' }, 400);
      effectiveTutorId = body.tutor_id;
    } else {
      if (!anonKey) throw new Error('SUPABASE_ANON_KEY not configured');
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
      const { data: ownRow, error: ownErr } = await supabase
        .from('parents').select('id').eq('user_id', userData.user.id).maybeSingle();
      if (ownErr || !ownRow) return json({ error: 'No tutor profile for caller' }, 403);
      effectiveTutorId = ownRow.id;
    }

    const summary = await processTutor(supabase, effectiveTutorId);
    return json({ success: true, tutor_id: effectiveTutorId, ...summary }, 200);
  } catch (error) {
    console.error('auto-complete-lessons error:', error);
    return json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});

async function processTutor(supabase: SupabaseClient, tutorId: string) {
  const { data: tutor, error: tutorErr } = await supabase
    .from('parents')
    .select('id, user_id, timezone, auto_complete_lessons')
    .eq('id', tutorId)
    .single();
  if (tutorErr || !tutor) throw new Error('Tutor not found');
  if (tutor.auto_complete_lessons === false) {
    return { skipped: true, reason: 'disabled', completed: 0, invoiced: 0, paid: 0 };
  }

  // tutor_settings is keyed by auth user id (= parents.user_id), not parents.id.
  const { data: settings } = await supabase
    .from('tutor_settings')
    .select('default_rate, default_base_duration, subject_rates, combined_session_rate')
    .eq('tutor_id', tutor.user_id)
    .maybeSingle();

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const oldestIso = new Date(nowMs - MAX_LESSON_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Candidate lessons: this tutor's still-scheduled lessons that have already
  // started and are within the look-back window.
  const { data: rows, error: lessonsErr } = await supabase
    .from('scheduled_lessons')
    .select(
      'id, subject, scheduled_at, duration_min, session_id, override_amount, ' +
        'student:students!inner(id, parent_id, parent:parents!parent_id(id, billing_mode, prepaid_subjects))',
    )
    .eq('tutor_id', tutorId)
    .eq('status', 'scheduled')
    .lt('scheduled_at', nowIso)
    .gte('scheduled_at', oldestIso);
  if (lessonsErr) throw new Error(lessonsErr.message);

  const due = dueLessons((rows ?? []) as CandidateLesson[], nowMs, MAX_LESSON_AGE_DAYS);
  if (due.length === 0) return { completed: 0, invoiced: 0, paid: 0, parents: 0 };

  // 1. Complete each due lesson; collect (parent, month) pairs needing an invoice.
  const invoiceTargets = new Map<string, { parentId: string; monthStart: string }>();
  let completed = 0;
  for (const l of due) {
    const parent = l.student?.parent;
    if (!parent) continue;
    const subjectPrepaid = isSubjectPrepaid(parent.billing_mode, parent.prepaid_subjects, l.subject);

    // Status guard (eq status scheduled) makes this a no-op if something else
    // already completed/cancelled the lesson between the read and the write.
    const { data: updated, error: upErr } = await supabase
      .from('scheduled_lessons')
      .update({ status: 'completed', auto_completed_at: nowIso, updated_at: nowIso })
      .eq('id', l.id)
      .eq('status', 'scheduled')
      .select('id')
      .maybeSingle();
    if (upErr) { console.error('complete failed', l.id, upErr.message); continue; }
    if (!updated) continue; // already handled by someone else
    completed++;

    const monthStart = monthStartOf(l.scheduled_at);
    if (subjectPrepaid) {
      await incrementPrepaid(supabase, parent.id, monthStart, l.subject, parent.prepaid_subjects ?? []);
    } else {
      invoiceTargets.set(`${parent.id}|${monthStart}`, { parentId: parent.id, monthStart });
    }
  }

  // 2. Generate + settle one invoice per (parent, month).
  let invoiced = 0;
  let paid = 0;
  for (const { parentId, monthStart } of invoiceTargets.values()) {
    const payment = await generateInvoice(supabase, tutor.id, parentId, monthStart, settings);
    if (payment) {
      invoiced++;
      if (await markPaid(supabase, payment.id)) paid++;
    }
  }

  return { completed, invoiced, paid, parents: invoiceTargets.size };
}

// Port of useCompleteLesson's prepaid increment (useLessons.ts:644-696).
async function incrementPrepaid(
  supabase: SupabaseClient,
  parentId: string,
  monthStart: string,
  subject: string,
  prepaidSubjects: string[],
) {
  const lower = (prepaidSubjects ?? []).map((s) => s.toLowerCase());
  let { data: prepaid } = await supabase
    .from('payments')
    .select('id, sessions_used')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'prepaid')
    .eq('subject', subject)
    .maybeSingle();

  if (!prepaid && lower.length === 0) {
    const { data: legacy } = await supabase
      .from('payments')
      .select('id, sessions_used')
      .eq('parent_id', parentId)
      .eq('month', monthStart)
      .eq('payment_type', 'prepaid')
      .is('subject', null)
      .maybeSingle();
    prepaid = legacy;
  }

  if (prepaid) {
    await supabase
      .from('payments')
      .update({ sessions_used: (prepaid.sessions_used || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', prepaid.id);
  }
}

// Port of useQuickInvoice.generateQuickInvoice (usePayments.ts:1799-1992),
// keyed on a 'YYYY-MM-01' month string. Also stamps payments.tutor_id (the app's
// quickInvoice omits it; setting it keeps recap revenue queries accurate).
async function generateInvoice(
  supabase: SupabaseClient,
  tutorId: string,
  parentId: string,
  monthStart: string,
  settings: unknown,
) {
  const monthEnd = monthEndOf(monthStart);

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, amount_due, status, payment_type')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'invoice')
    .is('subject', null)
    .maybeSingle();

  const { data: parentRecord } = await supabase
    .from('parents').select('prepaid_subjects').eq('id', parentId).single();
  const prepaidSubjects: string[] = (parentRecord?.prepaid_subjects as string[]) || [];

  const { data: subjectPrepaidPayments } = await supabase
    .from('payments')
    .select('subject')
    .eq('parent_id', parentId)
    .eq('month', monthStart)
    .eq('payment_type', 'prepaid')
    .not('subject', 'is', null);

  const prepaidPaymentSubjects = new Set<string>([
    ...prepaidSubjects.map((s) => s.toLowerCase()),
    ...(subjectPrepaidPayments ?? [])
      .filter((p: { subject: string | null }) => p.subject !== null)
      .map((p: { subject: string | null }) => p.subject!.toLowerCase()),
  ]);

  const { data: students } = await supabase.from('students').select('id').eq('parent_id', parentId);
  if (!students || students.length === 0) return null;
  const studentIds = students.map((s: { id: string }) => s.id);

  const { data: lessons } = await supabase
    .from('scheduled_lessons')
    .select('id, student_id, subject, duration_min, session_id, override_amount')
    .in('student_id', studentIds)
    .eq('status', 'completed')
    .gte('scheduled_at', monthStart)
    .lte('scheduled_at', monthEnd + 'T23:59:59.999Z');
  if (!lessons || lessons.length === 0) return null;

  const { data: invoicedLessons } = await supabase
    .from('payment_lessons')
    .select('lesson_id')
    .in('lesson_id', lessons.map((l: { id: string }) => l.id));
  const invoicedIds = new Set((invoicedLessons ?? []).map((il: { lesson_id: string }) => il.lesson_id));

  const uninvoiced = lessons.filter(
    (l: { id: string; subject: string }) =>
      !invoicedIds.has(l.id) && !prepaidPaymentSubjects.has(l.subject.toLowerCase()),
  );
  if (uninvoiced.length === 0) return null;

  const lessonAmounts = uninvoiced.map((l: any) => ({
    lesson_id: l.id,
    amount:
      Math.round(
        calculateLessonAmount(
          (settings as any) ?? null,
          l.subject,
          Number(l.duration_min) || 0,
          l.session_id !== null,
          l.override_amount == null ? null : Number(l.override_amount),
        ) * 100,
      ) / 100,
  }));
  const roundedTotal = Math.round(lessonAmounts.reduce((s: number, l: { amount: number }) => s + l.amount, 0) * 100) / 100;

  let payment;
  if (existingPayment) {
    const newAmountDue = Math.round((existingPayment.amount_due + roundedTotal) * 100) / 100;
    const newStatus = existingPayment.status === 'paid' ? 'unpaid' : existingPayment.status;
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({ amount_due: newAmountDue, status: newStatus, notes: `Updated: added ${uninvoiced.length} new lesson(s)` })
      .eq('id', existingPayment.id)
      .select()
      .single();
    if (updateError) throw new Error(updateError.message);
    payment = updatedPayment;
  } else {
    const { data: newPayment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        parent_id: parentId,
        month: monthStart,
        amount_due: roundedTotal,
        amount_paid: 0,
        status: 'unpaid',
        payment_type: 'invoice',
        tutor_id: tutorId,
        notes: `Auto invoice for ${uninvoiced.length} lesson(s)`,
      })
      .select()
      .single();
    if (paymentError) throw new Error(paymentError.message);
    payment = newPayment;
  }

  const links = lessonAmounts.map((la: { lesson_id: string; amount: number }) => ({
    payment_id: payment.id,
    lesson_id: la.lesson_id,
    amount: la.amount,
  }));
  const { error: linkError } = await supabase.from('payment_lessons').insert(links);
  if (linkError) {
    if (!existingPayment) await supabase.from('payments').delete().eq('id', payment.id);
    throw new Error(`Failed to link lessons: ${linkError.message}`);
  }
  return payment;
}

// Port of useMarkPaymentPaid (usePayments.ts:390-429). The existing
// sync_payment_lessons_paid_status() trigger flips payment_lessons.paid on this.
async function markPaid(supabase: SupabaseClient, paymentId: string): Promise<boolean> {
  const { data: cur, error: e1 } = await supabase
    .from('payments').select('amount_due').eq('id', paymentId).single();
  if (e1 || !cur) { console.error('markPaid fetch failed', e1?.message); return false; }
  const now = new Date().toISOString();
  const { error: e2 } = await supabase
    .from('payments')
    .update({ amount_paid: cur.amount_due, status: 'paid', paid_at: now, updated_at: now })
    .eq('id', paymentId);
  if (e2) { console.error('markPaid update failed', e2.message); return false; }
  return true;
}

// 'YYYY-MM-01' for the month containing the given timestamp (UTC, matching a
// UTC-running getMonthStart). Month-boundary lessons in non-UTC tutor tz are an
// accepted edge nuance, consistent with the existing client behavior.
function monthStartOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
// Last calendar day 'YYYY-MM-DD' of the same month.
function monthEndOf(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Type-check the function with Deno**

Run:
```bash
deno check supabase/functions/auto-complete-lessons/index.ts
```
Expected: no type errors. (Fix any import/type mismatch before continuing.)

- [ ] **Step 3: Serve functions locally**

Run (leave running in a separate terminal):
```bash
npx supabase functions serve auto-complete-lessons --no-verify-jwt
```
Expected: "Serving functions on http://localhost:54321/functions/v1/auto-complete-lessons".

- [ ] **Step 4: Manual integration check — invoice path**

Seed via SQL (using the local DB URL from `npx supabase status`): pick a real `tutor_id`, an invoice-billed parent with a student, and insert one `scheduled_lessons` row with `status='scheduled'`, `tutor_id` set, `scheduled_at` two hours ago, `duration_min=60`. Then:
```bash
SERVICE_KEY=$(npx supabase status -o env | grep SERVICE_ROLE_KEY | cut -d= -f2- | tr -d '"')
curl -s -X POST http://localhost:54321/functions/v1/auto-complete-lessons \
  -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" \
  -d '{"tutor_id":"<TUTOR_UUID>"}' | jq
```
Expected JSON: `{ "success": true, "completed": 1, "invoiced": 1, "paid": 1, ... }`.
Verify in DB: the lesson is `completed` with `auto_completed_at` set; a `payments` row (`payment_type='invoice'`, `status='paid'`) exists; a `payment_lessons` row exists with `paid=true`.

- [ ] **Step 5: Manual integration check — idempotency & toggle**

Re-run the same `curl`. Expected: `"completed": 0` (no duplicate `payment_lessons`).
Set the tutor's toggle off: `update parents set auto_complete_lessons=false where id='<TUTOR_UUID>';`, insert another past-due scheduled lesson, re-run `curl`. Expected: `{ "skipped": true, "reason": "disabled" }` and the lesson stays `scheduled`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/auto-complete-lessons/index.ts
git commit -m "feat(auto-complete): edge function completes + invoices + settles due lessons"
```

---

## Task 5: SQL dispatcher + hourly cron

Mirrors `send_weekly_tutor_recaps()` / its cron, gated on tutor-local 23:00 + toggle.

**Files:**
- Create: `supabase/migrations/<timestamp>_auto_complete_schedule.sql`

- [ ] **Step 1: Create the migration**

Run:
```bash
npx supabase migration new auto_complete_schedule
```

- [ ] **Step 2: Write the dispatcher + schedule**

Put this in the new file:
```sql
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
```

- [ ] **Step 3: Apply locally**

Run:
```bash
npx supabase db reset
```
Expected: completes without error.

- [ ] **Step 4: Verify the function runs and gates correctly**

With the functions still served locally and a real tutor present, run via the local DB URL:
```bash
psql "<LOCAL_DB_URL>" -c "select auto_complete_due_lessons();"
```
Expected: returns an integer = number of tutors for whom it is currently 23:00 local (often 0). No error. (Vault secrets are typically unset locally, so it returns 0 with the notice — that is the correct guard behavior; this confirms the no-op path. Full dispatch is validated against the deployed environment in Task 10.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_auto_complete_schedule.sql
git commit -m "feat(auto-complete): hourly cron dispatcher gated on tutor-local end of day"
```

---

## Task 6: Fix `useUncompleteLesson` to clean up invoiced lessons

Auto-completed invoice lessons now have `payment_lessons` rows; reversing must clean them up.

**Files:**
- Modify: `src/hooks/useLessons.ts:726-830` (`useUncompleteLesson`)

- [ ] **Step 1: Add the cleanup after the status revert**

In `useUncompleteLesson`, immediately after the `scheduled_lessons` update succeeds (after the `if (updateError) { throw ... }` block at `useLessons.ts:746-748`) and before the prepaid-decrement section, insert this block (mirrors `useCancelLesson` `:533-566`):
```ts
      // Clean up any invoice links: an auto-completed (or manually completed +
      // invoiced) lesson has payment_lessons rows. Reverting completion must
      // remove them and reduce the parent payment's amount_due, or the invoice
      // stays inflated. Mirrors useCancelLesson's cleanup.
      const { data: paymentLessonLinks } = await supabase
        .from('payment_lessons')
        .select('id, payment_id, amount')
        .eq('lesson_id', id);

      if (paymentLessonLinks && paymentLessonLinks.length > 0) {
        for (const pl of paymentLessonLinks) {
          await supabase.from('payment_lessons').delete().eq('id', pl.id);

          const { data: payment } = await supabase
            .from('payments')
            .select('id, amount_due, amount_paid')
            .eq('id', pl.payment_id)
            .single();

          if (payment) {
            const newAmountDue = Math.max(0, Math.round((payment.amount_due - pl.amount) * 100) / 100);
            const newStatus = newAmountDue <= payment.amount_paid ? 'paid' : 'unpaid';
            await supabase
              .from('payments')
              .update({ amount_due: newAmountDue, status: newStatus })
              .eq('id', payment.id);
          }
        }
      }
```

- [ ] **Step 2: Type-check**

Run:
```bash
npm run typecheck
```
Expected: passes (no new errors).

- [ ] **Step 3: Manual verification**

In the running app (or via SQL), take an auto-completed invoice lesson (has a `payment_lessons` row, parent payment `status='paid'`), call uncomplete from the lesson detail modal. Expected: lesson back to `scheduled`; its `payment_lessons` row deleted; `payments.amount_due` reduced by the lesson amount; `status` recomputed.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLessons.ts
git commit -m "fix(lessons): uncomplete now cleans up payment_lessons and adjusts amount_due"
```

---

## Task 7: Settings toggle (hook + Business settings UI)

**Files:**
- Create: `src/hooks/useAutoCompleteSetting.ts`
- Modify: `app/settings/business.tsx` (add a toggle row)

- [ ] **Step 1: Create the read/update hook**

Create `src/hooks/useAutoCompleteSetting.ts`:
```ts
/**
 * useAutoCompleteSetting.ts
 * Reads/updates the tutor's parents.auto_complete_lessons flag.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAutoCompleteSetting() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error: e } = await supabase
        .from('parents')
        .select('auto_complete_lessons')
        .eq('user_id', user.id)
        .maybeSingle();
      if (e) throw new Error(e.message);
      if (data) setEnabled(data.auto_complete_lessons !== false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load setting'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (next: boolean): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: e } = await supabase
        .from('parents')
        .update({ auto_complete_lessons: next, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (e) throw new Error(e.message);
      return true;
    } catch (err) {
      setEnabled(prev); // revert on failure
      setError(err instanceof Error ? err : new Error('Failed to update setting'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  return { enabled, loading, saving, error, update, refetch: load };
}
```

- [ ] **Step 2: Wire the toggle into Business settings**

In `app/settings/business.tsx`:

(a) Add `Switch` to the `react-native` import list (line 7-19 block):
```ts
  Switch,
```
(b) Import the hook near the other hook imports (after line 30):
```ts
import { useAutoCompleteSetting } from '../../src/hooks/useAutoCompleteSetting';
```
(c) Inside the component, after the other hook calls (`const { isDesktop } = useResponsive();`, line 49), add:
```ts
  const autoComplete = useAutoCompleteSetting();
```
(d) Add a new settings section in the JSX, immediately after the Timezone Section (which ends around `business.tsx:314-360`). Insert this block:
```tsx
        {/* Automation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automation</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.label}>Auto-complete & mark paid at end of day</Text>
              <Text style={styles.toggleHint}>
                Finished lessons are marked completed and paid automatically each night.
                Turn off to mark them yourself.
              </Text>
            </View>
            <Switch
              value={autoComplete.enabled}
              onValueChange={(v) => { autoComplete.update(v); }}
              disabled={autoComplete.loading || autoComplete.saving}
              trackColor={{ false: colors.neutral.border, true: colors.primary.main }}
            />
          </View>
        </View>
```
(e) Add the referenced styles to the `StyleSheet.create({...})` object at the bottom (near the existing `label` style ~`:533`):
```ts
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
```

> If `colors.primary.main` is not the correct token, use the brand teal token used elsewhere in this file for accents (check the existing imports/usages — `colors.primary` palette). Match the file's existing color usage.

- [ ] **Step 3: Type-check and lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: pass. Fix any token-name mismatches surfaced.

- [ ] **Step 4: Manual verification**

Run `npm run web`, go to Business settings. Expected: an "Automation" section with a working toggle that reflects and persists `parents.auto_complete_lessons` (refresh the page → state persists).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAutoCompleteSetting.ts app/settings/business.tsx
git commit -m "feat(settings): tutor toggle for end-of-day auto-complete"
```

---

## Task 8: Per-class paid pill in the lesson detail modal

Surface paid/unpaid on a completed lesson, derived from existing `payment_lessons.paid` — no schema change.

**Files:**
- Modify: `src/components/LessonDetailModal.tsx`
- Modify: `app/(tabs)/calendar.tsx` (pass a `paid` prop derived from a small lookup)

- [ ] **Step 1: Add a `paid` prop to the modal**

In `src/components/LessonDetailModal.tsx`, add to the props interface (near the other optional props ~line 54-57):
```ts
  paid?: boolean | null; // true=paid, false=unpaid (invoiced not settled), null=n/a
```
and to the destructured params (near `onUncomplete,` ~line 75):
```ts
  paid,
```

- [ ] **Step 2: Render a pill for completed lessons**

In the modal body where completed status is shown (near the `status === 'completed'` rendering — search the file for the status display), add a pill. Place it adjacent to the existing status indicator:
```tsx
        {status === 'completed' && paid != null && (
          <View
            style={[
              styles.paidPill,
              { backgroundColor: paid ? colors.status.success + '22' : colors.status.warning + '22' },
            ]}
          >
            <Ionicons
              name={paid ? 'cash-outline' : 'alert-circle-outline'}
              size={14}
              color={paid ? colors.status.success : colors.status.warning}
            />
            <Text style={[styles.paidPillText, { color: paid ? colors.status.success : colors.status.warning }]}>
              {paid ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
        )}
```
Add styles to the modal's `StyleSheet`:
```ts
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 6,
  },
  paidPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
```
> Use whatever `colors.status.*` tokens exist in `src/theme`. If `success`/`warning` aren't present, use the nearest existing tokens (e.g. `colors.math.primary` for paid, `colors.status.error`/coral for unpaid) — match this file's existing color usage.

- [ ] **Step 3: Derive and pass `paid` from the calendar**

In `app/(tabs)/calendar.tsx`, when a lesson group is selected, look up paid state for the (first) lesson from `payment_lessons`, and pass it to the modal. Add a small state + effect near the existing modal wiring (the modal render is ~`calendar.tsx:1320`):
```tsx
  const [selectedLessonPaid, setSelectedLessonPaid] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const first = selectedGroupedLesson?.lessons?.[0];
      if (!first || first.status !== 'completed') { setSelectedLessonPaid(null); return; }
      const { data } = await supabase
        .from('payment_lessons')
        .select('paid')
        .eq('lesson_id', first.id)
        .maybeSingle();
      if (!active) return;
      // No invoice row → prepaid-covered completion → treat as paid.
      setSelectedLessonPaid(data ? data.paid === true : true);
    })();
    return () => { active = false; };
  }, [selectedGroupedLesson]);
```
Then add the prop to the `<LessonDetailModal ... />` element:
```tsx
        paid={selectedLessonPaid}
```
Ensure `supabase` is imported in `calendar.tsx` (check existing imports; add `import { supabase } from '../../src/lib/supabase';` if absent).

- [ ] **Step 4: Type-check and lint**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: pass.

- [ ] **Step 5: Manual verification**

Run `npm run web`. Open a completed invoice lesson that's been auto-paid → pill shows "Paid". Mark its payment unpaid (payments screen) → reopen → pill shows "Unpaid". Open a completed prepaid lesson → pill shows "Paid".

- [ ] **Step 6: Commit**

```bash
git add src/components/LessonDetailModal.tsx app/(tabs)/calendar.tsx
git commit -m "feat(calendar): show paid/unpaid pill on completed lessons"
```

---

## Task 9: Recap surfacing — paid indicator + auto-marked count

**Files:**
- Modify: `supabase/functions/send-telegram-recap/recap.ts` (`RecapData`, `RecapLesson`, `buildRecapMessage`)
- Modify: `supabase/functions/send-telegram-recap/recap.test.ts`
- Modify: `supabase/functions/send-telegram-recap/index.ts` (query + pass new fields)

- [ ] **Step 1: Write failing tests for the new recap output**

In `supabase/functions/send-telegram-recap/recap.test.ts`, add:
```ts
Deno.test('recap shows auto-marked count when present', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [{ date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed', paid: true }],
    received: 0, outstanding: 0, expected: 45, autoMarked: 1,
  });
  if (!msg.includes('auto-marked')) throw new Error('expected auto-marked line');
  if (!msg.includes('💵')) throw new Error('expected paid indicator on class line');
});

Deno.test('recap omits auto-marked line when zero', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [{ date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed', paid: false }],
    received: 0, outstanding: 0, expected: 45, autoMarked: 0,
  });
  if (msg.includes('auto-marked')) throw new Error('did not expect auto-marked line');
});
```

- [ ] **Step 2: Run to verify failure**

Run:
```bash
deno test supabase/functions/send-telegram-recap/recap.test.ts
```
Expected: FAIL (type error on `paid`/`autoMarked`, or missing strings).

- [ ] **Step 3: Extend the recap types and message builder**

In `recap.ts`, update interfaces:
```ts
export interface RecapLesson {
  date: string;
  studentName: string;
  subjectLabel: string;
  status: string;
  paid?: boolean;   // shown only for completed lessons
}

export interface RecapData {
  rangeLabel: string;
  lessons: RecapLesson[];
  received: number;
  outstanding: number;
  expected: number;
  autoMarked?: number;
}
```
In `buildRecapMessage`, change the class-line mapping to append a 💵 for paid completed lessons, and add an auto-marked line. Replace the `lessonLines` mapping with:
```ts
  const lessonLines = d.lessons.length
    ? d.lessons
        .map((l) => {
          const mark = statusMark[l.status] ?? '•';
          const money = l.status === 'completed' && l.paid ? ' 💵' : '';
          return `${mark} ${escapeHtml(l.date)} — ${escapeHtml(l.studentName)} · ${escapeHtml(l.subjectLabel)}${money}`;
        })
        .join('\n')
    : '<i>No classes this week.</i>';
```
And insert an auto-marked line into the returned array, right after the `lessonLines` entry (before the blank line preceding Payments):
```ts
    ...(d.autoMarked && d.autoMarked > 0 ? [`<i>${d.autoMarked} auto-marked this week</i>`] : []),
```

- [ ] **Step 4: Run recap tests to verify pass**

Run:
```bash
deno test supabase/functions/send-telegram-recap/recap.test.ts
```
Expected: all pass (including the two new tests).

- [ ] **Step 5: Populate the new fields in the recap query**

In `supabase/functions/send-telegram-recap/index.ts`:

(a) Extend the classes select (line 146) to include `auto_completed_at` and the lesson's paid link:
```ts
      .select('id, subject, scheduled_at, duration_min, status, override_amount, auto_completed_at, payment_lessons(paid), student:students!inner(name)')
```
(b) Where `lessons` is mapped (line 152-161), add `paid`:
```ts
      paid: Array.isArray((l as any).payment_lessons)
        ? (l as any).payment_lessons.some((pl: any) => pl.paid === true)
        : false,
```
(c) Compute `autoMarked` from rows in window after the lessons map:
```ts
    const autoMarked = (lessonRows ?? []).filter((l: any) => l.auto_completed_at != null).length;
```
(d) Pass it into `buildRecapMessage` (line 218):
```ts
    const text = buildRecapMessage({ rangeLabel, lessons, received, outstanding, expected, autoMarked });
```

- [ ] **Step 6: Type-check the function**

Run:
```bash
deno check supabase/functions/send-telegram-recap/index.ts
```
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/send-telegram-recap/recap.ts supabase/functions/send-telegram-recap/recap.test.ts supabase/functions/send-telegram-recap/index.ts
git commit -m "feat(recap): show paid indicator and auto-marked count"
```

---

## Task 10: Deploy & end-to-end verification

**Files:** none (deployment).

- [ ] **Step 1: Push migrations**

Run:
```bash
npx supabase db push
```
Expected: the two new migrations apply to the remote DB.

- [ ] **Step 2: Deploy the edge functions**

Run:
```bash
npx supabase functions deploy auto-complete-lessons
npx supabase functions deploy send-telegram-recap
```
Expected: both deploy successfully.

- [ ] **Step 3: Confirm Vault secrets exist**

The dispatcher needs `project_url` and `service_role_key` in Vault (same ones the recap cron uses). Verify:
```bash
psql "<REMOTE_DB_URL>" -c "select name from vault.decrypted_secrets where name in ('project_url','service_role_key');"
```
Expected: both rows present. (If missing, the cron silently no-ops — set them as was done for the telegram recap.)

- [ ] **Step 4: Force a real dispatch and verify**

On the remote DB, with a seeded past-due `scheduled` lesson for a toggle-on tutor:
```bash
psql "<REMOTE_DB_URL>" -c "select auto_complete_due_lessons();"
```
This dispatches regardless of the hour only if it's 23:00 local for that tutor; to test on demand, instead invoke the function directly for one tutor:
```bash
curl -s -X POST "<PROJECT_URL>/functions/v1/auto-complete-lessons" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "Content-Type: application/json" \
  -d '{"tutor_id":"<TUTOR_UUID>"}' | jq
```
Expected: `{ success: true, completed: N, invoiced: …, paid: … }`; verify the lesson, payment, and `payment_lessons.paid` in the DB as in Task 4.

- [ ] **Step 5: Confirm the cron job is registered**

Run:
```bash
psql "<REMOTE_DB_URL>" -c "select jobname, schedule from cron.job where jobname = 'auto-complete-lessons';"
```
Expected: one row, schedule `0 * * * *`.

- [ ] **Step 6: Final commit / open PR**

```bash
git push -u origin feature/auto-complete-lessons
gh pr create --fill --base main
```

---

## Notes for the implementer

- **Optimistic-by-design + bounded:** the job only sweeps lessons that started within `MAX_LESSON_AGE_DAYS` (7). Lessons older than that stay `scheduled` for manual handling, so enabling the toggle won't sweep an ancient backlog. Mention the window in the PR description.
- **One source of truth for "paid":** do NOT add a `scheduled_lessons.paid` column. Paid lives in `payment_lessons.paid` / `payments.status`. The pill (Task 8) only *reads* it.
- **End-of-day hour is hardcoded to 23 (tutor-local).** Per-tutor configurability is intentionally out of scope.
- **Keep the rate math single-sourced:** all amount calculations go through `_shared/lessonAmount.ts`. If invoice rates change in `src/hooks/usePayments.ts`, update the shared helper + its test too.
