# Auto-complete & auto-pay lessons — Design

**Date:** 2026-06-07
**Status:** Approved (design phase)

## Problem

Today a tutor must manually mark each scheduled lesson as **completed** and track its
payment status. This is per-class busywork done at end of day or end of week. The tutor
wants finished lessons to be marked **completed + paid automatically**, and to only step
in for the exceptions — a class that was **unpaid** or **cancelled**. Everything else
should default to completed + paid.

## Decisions (from brainstorming)

1. **Paid is optimistic.** Lessons are marked paid by default; the tutor reverses the few
   that weren't actually paid.
2. **Fires at end of day, tutor-local.** Batch the day's finished lessons late each
   evening in the tutor's timezone (not immediately at lesson-end).
3. **Per-tutor toggle, default on.** Every tutor gets the automation immediately but can
   turn it off and return to manual marking.
4. **Visibility folds into existing channels.** No new dedicated notification; auto-marked
   lessons surface through the in-app calendar and the existing Telegram weekly recap.
5. **Per-class paid flag on the lesson.** For invoice families, "paid" becomes a flag
   directly on the lesson (today it only exists at the monthly-invoice level and only
   after an invoice is generated). A paid/unpaid pill shows on the lesson card; monthly
   invoicing inherits the flag.

## Core principle

The nightly job is **exactly equivalent to the tutor pressing "Complete" on each finished
lesson, plus marking it paid.** Same prepaid bookkeeping, same side effects — just
automated, with `paid = true` added optimistically. This parity is the spec: auto-completion
must produce the same result as a manual completion, never a divergent one.

## Background (current behavior)

- `scheduled_lessons.status` is the enum `scheduled | completed | cancelled`.
  Lesson end time is computed as `scheduled_at + duration_min` (no stored end column).
- **Completion** (`useCompleteLesson()`, `src/hooks/useLessons.ts`) flips status to
  `completed` and, for prepaid families, increments `payments.sessions_used` for the
  matching month/subject (respecting `parents.prepaid_subjects` for hybrid billing).
- **Paid** for **prepaid** families is implicit: completion consumes a prepaid session.
- **Paid** for **invoice** families lives in `payment_lessons.paid` + `payments.status`,
  and `payment_lessons` rows **only exist after a monthly invoice is generated**
  (`useGenerateInvoice()` in `src/hooks/usePayments.ts`) — typically days/weeks after the
  lesson. So at lesson-end there is no per-class paid record for invoice families, and the
  lesson card surfaces no paid status at all.
- **Cancellation** (`useCancelLesson()`) sets `cancelled`, deletes linked `payment_lessons`
  rows, and reduces `payments.amount_due`.
- Existing automation: pg_cron job `telegram-weekly-recaps` runs hourly and gates on each
  tutor's local time via `parents.timezone`, calling an edge function through Vault secrets
  (`project_url`, `service_role_key`). Pure-DB jobs do **not** need this hop.

## Design

### 1. Data model changes

New migration adds:

- `scheduled_lessons.paid BOOLEAN NOT NULL DEFAULT false` — per-class payment status; the
  new source of truth for "this class was paid."
  - **Backfill:** for historical lessons, set `paid = true` where a linked
    `payment_lessons.paid = true` exists; otherwise `false`.
- `scheduled_lessons.auto_completed_at TIMESTAMPTZ NULL` — set when the job auto-marks a
  lesson. Distinguishes auto from manual (used by the recap), **not** used for idempotency.
- `parents.auto_complete_lessons BOOLEAN NOT NULL DEFAULT true` — the per-tutor toggle.
  Existing tutor rows are set to `true` by the migration.

### 2. Single source of truth for completion effects

Extract a `SECURITY DEFINER` DB function:

```
complete_lesson(p_lesson_id uuid, p_set_paid boolean) returns void
```

It encapsulates the full completion effect: set `status='completed'`, apply the prepaid
`sessions_used` increment (mirroring today's `useCompleteLesson` logic exactly, including
`prepaid_subjects` hybrid handling), set `paid = p_set_paid`, and stamp `updated_at`.

- The cron job calls it with `p_set_paid = true` and additionally stamps
  `auto_completed_at = now()`.
- `useCompleteLesson()` is **refactored to call this function via RPC** instead of
  duplicating the prepaid logic in TypeScript. One implementation, used by both paths.
  (Manual completion passes `p_set_paid` per existing UI behavior — preserve whatever the
  manual flow does today for paid; manual completion does not need to force paid.)

### 3. The end-of-day job

A `SECURITY DEFINER` function:

```
auto_complete_due_lessons() returns void
```

scheduled hourly via `pg_cron` (`0 * * * *`). This is **pure DB work** — no edge function,
no Vault secrets (unlike the telegram recap). Schedule with:

```
select cron.schedule('auto-complete-lessons', '0 * * * *',
  $$ select auto_complete_due_lessons() $$);
```

Each tick, for every tutor where:

- `parents.auto_complete_lessons = true`, **and**
- the tutor's **local hour is 23** (end of day), derived as
  `extract(hour from now() at time zone parents.timezone) = 23`

it processes that tutor's lessons where:

- `status = 'scheduled'`, **and**
- end time has passed: `scheduled_at + (duration_min * interval '1 minute') < now()`

For each such lesson it calls `complete_lesson(lesson_id, true)` and sets
`auto_completed_at = now()`.

**Safety / idempotency:**

- Only ever touches `status = 'scheduled'` rows → never overrides a manual complete or
  cancel, never double-processes.
- Past-due stragglers (e.g. a late Friday-night lesson that hadn't ended at the 23:00 tick)
  are caught on the next day's tick because the filter is "any past-due scheduled lesson,"
  not "today only." Nothing is missed; at most a one-day delay for after-23:00 lessons.
- Tutors with the toggle off are skipped entirely.

**v1 default:** end-of-day hour is hardcoded to `23` local. Per-tutor configurability is a
later enhancement (would add a `parents.auto_complete_hour` column).

### 4. Invoice integration

`useGenerateInvoice()` is updated so that newly created `payment_lessons` rows **inherit
`paid` from `scheduled_lessons.paid`** (instead of always `false`), and the resulting
`payments.status` is computed from the inherited values:

- all inherited `paid = true` → `paid`
- some `true`, some `false` → `partial`
- none `true` → `unpaid`

`amount_paid` / `paid_at` are set consistently with the computed status. The existing
one-way trigger `sync_payment_lessons_paid_status()` (`payment.status='paid'` → all linked
lessons `paid=true`) is left in place and does not conflict, since this change only sets
initial values at insert time.

### 5. Tutor adjusts the exceptions

- **Mark unpaid:** a tappable paid/unpaid pill on the lesson card and in the lesson detail
  modal flips `scheduled_lessons.paid`. New lightweight hook (e.g.
  `useToggleScheduledLessonPaid`) — distinct from the existing `useToggleLessonPaid` which
  operates on `payment_lessons`. If the lesson is already invoiced, the hook also syncs the
  linked `payment_lessons.paid` so the books stay consistent.
- **Cancel / didn't happen:** the existing `useCancelLesson()` and `useUncompleteLesson()`
  paths are made reachable from an auto-completed lesson (the detail modal must offer these
  actions when `status = 'completed'`).

**Known pre-existing gap (flagged, out of scope):** `useUncompleteLesson()` does not clean
up `payment_lessons` when reverting an *already-invoiced* lesson. This is acceptable for the
auto-flow because auto-pay precedes invoicing; documented here so it isn't mistaken for new
breakage.

### 6. Visibility (folded into existing channels)

- **In-app:** auto-marked lessons appear `completed` with a **paid** pill on the calendar.
  No new notification.
- **Telegram weekly recap** (`supabase/functions/send-telegram-recap`): add a paid
  indicator (💵) to the class lines and a small "*N auto-marked this week*" count, computed
  from `auto_completed_at` falling in the recap window. Reuses the existing recap delivery;
  no new mechanism.

### 7. Settings UI

Add an **"Automatically complete & mark paid at end of day"** toggle to the tutor settings
screen, bound to `parents.auto_complete_lessons`.

## Testing

**DB (`auto_complete_due_lessons` / `complete_lesson`):**

- Due `scheduled` lesson for a toggle-on tutor at 23:00 local → becomes `completed` + `paid`
  + `auto_completed_at` set.
- Toggle off → lesson untouched.
- `cancelled` lesson → untouched.
- Lesson not yet ended → untouched.
- Second run (idempotency) → no further changes.
- Prepaid family → `sessions_used` increments identically to a manual completion (including
  hybrid `prepaid_subjects`).
- Timezone gating → a tutor is only processed when it is 23:00 in their `timezone`.

**Invoice inheritance:**

- Generate an invoice after auto-pay → `payment_lessons.paid` reflects each lesson's
  `paid`, and `payments.status` is `paid` / `partial` / `unpaid` accordingly.

**Reversal:**

- Toggling the lesson paid pill flips `scheduled_lessons.paid`; if invoiced, the linked
  `payment_lessons.paid` is synced.

## Out of scope (future enhancements)

- Per-tutor configurable end-of-day hour (`parents.auto_complete_hour`).
- Cleaning up `payment_lessons` on uncomplete of an already-invoiced lesson.
- A dedicated per-run notification (explicitly declined in favor of folding into existing
  channels).
