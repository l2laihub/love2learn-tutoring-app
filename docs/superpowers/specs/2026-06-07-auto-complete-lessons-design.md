# Auto-complete & auto-pay lessons — Design

**Date:** 2026-06-07
**Status:** Approved (design phase, revised after code discovery)

## Problem

Today a tutor must manually mark each scheduled lesson as **completed** and settle its
payment. This is per-class busywork done at end of day or end of week. The tutor wants
finished lessons to be marked **completed + paid automatically**, stepping in only for the
exceptions — a class that was **unpaid** or **cancelled**. Everything else should default
to completed + paid.

## Decisions (from brainstorming)

1. **Paid is optimistic.** Lessons are marked paid by default; the tutor reverses the few
   that weren't actually paid.
2. **Fires at end of day, tutor-local.** Batch the day's finished lessons late each evening
   in the tutor's timezone (not immediately at lesson-end).
3. **Per-tutor toggle, default on.** Every tutor gets the automation immediately but can
   turn it off and return to manual marking.
4. **Visibility folds into existing channels.** No new dedicated notification; auto-marked
   lessons surface through the in-app calendar and the existing Telegram weekly recap.
5. **Reuse the existing "Complete & Mark as Paid" flow** (see Key discovery) rather than
   inventing a parallel per-lesson paid notion.

## Key discovery (why this design was revised)

The app **already** automates completion-time invoicing, and already has the exact behavior
the tutor wants — just triggered manually. In `app/(tabs)/calendar.tsx`:

- **`handleCompleteLesson`** (`:602`) — on "Complete", for every lesson in the group it
  calls `completeLesson.mutate()` (sets `status='completed'`, increments prepaid
  `sessions_used` for prepaid subjects) **and** auto-generates/updates the monthly invoice
  for invoice-billed subjects via `useQuickInvoice` (`:646`).
- **`handleCompleteLessonAndPay`** (`:661`) — does all of the above **plus**
  `markPaymentPaid.mutate(payment.id)` (`:703`), which sets the payment `status='paid'`;
  the existing trigger `sync_payment_lessons_paid_status()` then flips every linked
  `payment_lessons.paid = true`.

So "paid" for invoice families is **already represented per lesson** in
`payment_lessons.paid` (+ `payments.status`), and invoices are generated at completion, not
in a separate monthly step. Adding a new `scheduled_lessons.paid` column (the earlier draft)
would create a **second, divergent** source of truth and an incomplete copy of completion.

**Therefore:** the automation is simply a server-side replay of `handleCompleteLessonAndPay`
for each finished lesson, run nightly per tutor.

### Faithful-port note

`useQuickInvoice` prices lessons with `calculateLessonAmountFromSettings` →
`calculateLessonAmountWithDetails` (`src/hooks/usePayments.ts:1320`). That function uses
**duration-based subject rates for all lessons including combined sessions** — it ignores
the `isCombinedSession` flag for the amount. The dependency-free
`calculateLessonAmount` already shipped in `supabase/functions/send-telegram-recap/recap.ts`
is value-identical to it (verified). The edge function reuses that helper (relocated to a
shared module) so there is no fourth copy of the rate math.

## Architecture

A new **scheduled edge function** `auto-complete-lessons`, invoked hourly by `pg_cron` via
`pg_net` — the **same pattern** as the existing `telegram-weekly-recaps` cron
(`supabase/migrations/20260608005154_telegram_recap_schedule.sql`). A SQL dispatcher
function iterates tutors, gates on tutor-local end-of-day + the per-tutor toggle, and POSTs
`{ tutor_id }` to the edge function with the service-role key. The edge function does the
actual work, reusing the real completion + invoice + mark-paid logic ported to Deno.

Trade-off accepted: this depends on the Vault secrets `project_url` and `service_role_key`
already used by the recap cron. (Memory note: the cron silently no-ops if those are unset —
the dispatcher logs a notice and returns, same as the recap one.)

## Design

### 1. Data model changes (one migration)

- `parents.auto_complete_lessons BOOLEAN NOT NULL DEFAULT true` — the per-tutor toggle.
  Existing rows default to `true`. (Lives alongside `timezone`, `telegram_recap_enabled`.)
- `scheduled_lessons.auto_completed_at TIMESTAMPTZ NULL` — stamped by the job when it
  auto-marks a lesson. Powers the recap's "N auto-marked" count and distinguishes auto from
  manual. **Not** used for idempotency (status does that).

No `scheduled_lessons.paid` column — paid stays in `payment_lessons.paid` / `payments.status`.

### 2. SQL dispatcher + cron (same migration)

`auto_complete_due_lessons() returns integer`, `SECURITY DEFINER`, mirroring
`send_weekly_tutor_recaps()`:

- Reads `project_url` / `service_role_key` from Vault; if missing, `raise notice` and return 0.
- For each `parents` row where `role='tutor'` and `auto_complete_lessons = true`:
  - Compute `v_local := now() at time zone coalesce(timezone,'America/Los_Angeles')`.
  - If `extract(hour from v_local) = 23` (end of day, tutor-local), POST
    `{ tutor_id }` to `…/functions/v1/auto-complete-lessons` with the service-role bearer.
- Wrap each tutor in a `begin/exception` block so one failure doesn't abort the loop.

Scheduled hourly (`0 * * * *`) under job name `auto-complete-lessons`; the function filters
to the 23:00-local hour. **v1 end-of-day hour = 23, hardcoded** (per-tutor configurability
is out of scope).

**No idempotency log needed.** The edge function only ever touches `status='scheduled'`
lessons whose end time has passed, so a repeat invocation is a no-op. Missed runs self-heal:
the next night's run still picks up any past-due `scheduled` lesson (the filter is "past-due
and scheduled", not "today only"). Documented consequence: enabling the toggle when a
backlog of old `scheduled` lessons exists will auto-complete+pay that backlog on the first
run — consistent with the optimistic model.

### 3. Edge function `auto-complete-lessons`

Files under `supabase/functions/auto-complete-lessons/`:

- `index.ts` — HTTP handler. Same auth shape as the recap function:
  - **Internal** (cron, `Authorization: Bearer <service_role>`): trust body `tutor_id`.
  - **Non-internal** (app, optional "run now" preview): resolve caller via JWT, force
    `tutor_id` to the caller's own `parents.id`. (Lets the settings screen offer a manual
    "Run now" without trusting client-supplied ids.)
  - Service-role Supabase client for all data work (bypasses RLS).
- `autocomplete.ts` — pure, unit-tested helpers: `dueLessons(rows, nowMs)` (filter to ended
  lessons), `isSubjectPrepaid(billingMode, prepaidSubjects, subject)`.
- `autocomplete.test.ts` — tests for the pure helpers.

Per invocation, for the resolved tutor:

1. Load tutor (`parents`: `id, user_id, timezone, auto_complete_lessons`); bail if toggle off.
2. Load `tutor_settings` keyed by `tutor.user_id` (same keying quirk as the recap).
3. Fetch candidate lessons: `scheduled_lessons` where `tutor_id = tutor.id`,
   `status='scheduled'`, `scheduled_at < now()`, joined to
   `student:students!inner(id, parent_id, parent:parents!parent_id(id, billing_mode, prepaid_subjects))`,
   selecting `id, subject, scheduled_at, duration_min, session_id, override_amount`.
4. `due = dueLessons(rows, Date.now())` — keep only lessons whose
   `scheduled_at + duration_min*60_000 <= now`.
5. **Complete each due lesson** (port of `useCompleteLesson`): set `status='completed'`,
   `auto_completed_at=now()`, `updated_at=now()`; for prepaid-billed subjects, increment the
   matching month/subject prepaid payment's `sessions_used` (subject-specific first, legacy
   all-subjects fallback only when `prepaid_subjects` is empty — identical rules to the hook).
6. **Per parent, generate + settle invoices** (port of `useQuickInvoice` +
   `useMarkPaymentPaid`): for invoice-billed subjects, build/extend the month's
   `payment_type='invoice'` payment, insert `payment_lessons` rows priced via the shared
   `calculateLessonAmount`, then set the payment `amount_paid=amount_due`, `status='paid'`,
   `paid_at=now()` so the existing trigger marks the lessons paid.
7. Return a summary `{ completed, invoiced, paid, parents }` (logged; surfaced to "Run now").

### 4. Shared rate helper (small refactor)

Relocate `calculateLessonAmount` (and the `SubjectRateConfig`/`TutorRateSettings` types) to
`supabase/functions/_shared/lessonAmount.ts`. `recap.ts` re-exports them so
`recap.test.ts` stays green unchanged; `auto-complete-lessons` imports from `_shared`. One
implementation, two callers.

### 5. Fix the uncomplete cleanup gap (now in scope)

Because auto-completed invoice lessons **will** have `payment_lessons` rows, reversing one
must clean up. `useUncompleteLesson()` (`src/hooks/useLessons.ts:726`) currently reverts
status + decrements prepaid but leaves `payment_lessons` (and inflated `payments.amount_due`)
behind. Extend it to also: delete the lesson's `payment_lessons` rows and reduce the parent
payment's `amount_due` (recomputing `status`), mirroring `useCancelLesson()`'s cleanup
(`:534-566`).

### 6. Tutor adjusts the exceptions

- **Mark unpaid:** reuse the existing per-lesson `useToggleLessonPaid()`
  (`payment_lessons.paid`) and/or `useMarkPaymentUnpaid()` — already wired in the payments
  screens. A paid/unpaid pill is added to the lesson detail modal / cards (see §7) so this
  is reachable from the calendar too.
- **Cancel / didn't happen:** existing `useCancelLesson()` (clean) and the now-fixed
  `useUncompleteLesson()`, already reachable from `LessonDetailModal` for completed lessons.

### 7. Per-class paid pill (derived, no new column)

Show a paid/unpaid indicator on completed lessons in `LessonDetailModal` (and lesson cards),
**derived from existing data**: a lesson is "paid" if its linked `payment_lessons.paid` is
true, or it is a prepaid-covered completion. A lightweight read (e.g. extend the lesson
fetch with the linked `payment_lessons(paid)`), no schema change.

### 8. Settings UI

Add an **"Automatically complete & mark paid at end of day"** toggle to the tutor business
settings screen (`app/settings/business.tsx`, which already edits `timezone`), bound to
`parents.auto_complete_lessons` via a small read/update hook. Optional "Run now" button that
invokes the edge function for the caller.

### 9. Recap surfacing (fold into existing)

In `supabase/functions/send-telegram-recap/`:

- `index.ts`: extend the classes query select with `auto_completed_at`; count lessons whose
  `auto_completed_at` falls in the window; pass `autoMarked` into the recap data.
- `recap.ts`: `buildRecapMessage` shows a 💵 on paid/auto-marked class lines and a
  "*N auto-marked this week*" line. Update `recap.test.ts` for the new field/line.

## Testing

**Pure helpers (`autocomplete.test.ts`, Deno):**
- `dueLessons` keeps only lessons whose end time ≤ now; excludes not-yet-ended.
- `isSubjectPrepaid`: fully-prepaid (empty `prepaid_subjects`) → true for any subject;
  hybrid → true only for listed subjects; invoice → false.

**Shared rate helper (`_shared/lessonAmount.test.ts`):** existing recap value cases pass
against the relocated function (combined-session amount == non-combined).

**Edge function (integration, against local Supabase):**
- A toggle-on tutor with a past-due `scheduled` invoice lesson → becomes `completed`,
  `auto_completed_at` set, a `payment_lessons` row exists with `paid=true`, the month's
  invoice `payments.status='paid'`.
- Toggle off → nothing changes.
- `cancelled` and not-yet-ended lessons → untouched.
- Re-invocation (idempotency) → no further changes (no duplicate `payment_lessons`).
- Prepaid subject → `sessions_used` increments once; no invoice row created.

**Uncomplete fix:** uncompleting an auto-completed invoice lesson deletes its
`payment_lessons` row and reduces `payments.amount_due` (status recomputed).

**Dispatcher:** unit-check the tutor-local hour gate (23:00) and toggle filter via a
SQL-level test (or manual `select auto_complete_due_lessons()` with seeded data).

## Out of scope (future)

- Per-tutor configurable end-of-day hour (`parents.auto_complete_hour`).
- A dedicated per-run notification (declined in favor of existing channels).
- Reworking the monthly invoice model itself.
