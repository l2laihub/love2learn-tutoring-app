# Tutor Weekly Openings — Design

**Date:** 2026-06-05
**Status:** Approved (pending implementation plan)

## Goal

Give tutors a dedicated screen showing **bookable 30-minute open slots per day** for a
navigable week, so a tutor can instantly answer "do you have anything open Wednesday?"
when a parent asks to reschedule.

The slots shown must match exactly what a parent sees in `RescheduleRequestModal`, so the
tutor and parent are always looking at the same availability.

## Definition of an "open slot"

For each day:

```
open slots = availability windows − booked lessons − breaks
```

…then sliced into 30-minute start times (`"10:00"`, `"10:30"`, …).

This is the same computation `RescheduleRequestModal` already performs for a single date,
generalized to a whole week. The computation runs in the tutor's configured timezone
(from `useTutorBranding()`), consistent with the rest of the calendar.

## Components / Files

### 1. Shared slot logic — `src/lib/openSlots.ts` (new)

Extract the slot-generation logic that currently lives inline in
`RescheduleRequestModal.tsx` into a pure, testable function.

```ts
computeOpenSlots({
  availabilityWindows, // [{ start: "09:00", end: "17:00" }, ...] for the day
  busyIntervals,       // [{ start: "09:00", end: "10:00" }, ...] booked lessons
  breaks,              // [{ start: "12:00", end: "13:00" }, ...]
  granularityMin = 30,
}): string[]           // free start times, e.g. ["10:00", "10:30", ...]
```

- Pure function — no hooks, no Supabase. Times are `"HH:MM"` strings in the tutor's
  local wall-clock time.
- A start time is "free" only if a `granularityMin` block starting there does not overlap
  any busy interval or break and falls within an availability window.
- `RescheduleRequestModal` is refactored to call this helper so both surfaces stay
  consistent. This is the only related refactor in scope.

### 2. Hook — `src/hooks/useWeekOpenSlots.ts` (new)

```ts
useWeekOpenSlots(weekStart: Date, timezone: string)
```

Composes existing data sources (no new tables, no new RPC):

- `useTutorAvailability({ tutorId })` — recurring windows (matched by `day_of_week`) plus
  `specific_date` windows. For each date, recurring + specific-date windows are **unioned**
  (matching existing `useAvailableSlotsForDate` behavior).
- `useWeekGroupedLessons(weekStart, timezone)` — booked lessons for the week. The tutor can
  see all of their own lessons via RLS, so no per-day `get_busy_slots_for_date` RPC is
  needed. Cancelled lessons are excluded from busy intervals.
- `useWeeklyBreaks()` — tutor breaks.

Returns one entry per day of the week:

```ts
{
  date: Date,
  dayLabel: string,          // e.g. "Mon Jun 8"
  slots: string[],           // free 30-min start times in tutor tz
  state: 'open' | 'fully-booked' | 'no-availability',
}
```

State rules:
- `no-availability` — no availability window defined for that day (distinct from booked).
- `fully-booked` — availability exists but every block is taken.
- `open` — at least one free slot.

### 3. Screen — `app/openings.tsx` (new, pushed route, not a tab)

- **Header:** week range label (e.g. "Jun 8 – Jun 14") with prev/next arrows and a
  "This week" reset. Defaults to the current week.
- **Body:** seven day sections. Each renders its free 30-min slots as chips, or the
  empty-state text for `fully-booked` / `no-availability`.
- **Timezone:** all display uses the tutor's timezone from `useTutorBranding()`.
- **Access:** tutor-only — guard with `isTutor`; non-tutors are redirected/blocked.

### 4. Entry points (both)

- **Calendar header button** "Openings" → `router.push('/openings')`, placed near the week
  navigation in `app/(tabs)/calendar.tsx`.
- **More tab item** "Openings" → `router.push('/openings')`.

## Edge cases

- **No availability defined** for a day → "No availability set" (distinct from fully booked).
- **Specific-date availability** is unioned with recurring availability for that date.
- **Past slots today** → today's already-passed start times are hidden. Fully-past days in a
  past week render as-is.
- **30-min grid limitation** — a single free 30-min start does not guarantee a 60-min lesson
  fits. This is the same limitation `RescheduleRequestModal` already has; v1 keeps the 30-min
  grid for consistency rather than filtering by lesson duration.

## Testing

- **Unit tests for `computeOpenSlots`:**
  - Full day free.
  - Fully booked.
  - Partial overlaps (lesson starts mid-window, ends mid-window).
  - Break in the middle of a window.
  - Back-to-back lessons leaving no gap.
  - Specific-date + recurring window union.
  - Granularity boundary cases (window not divisible by 30 min).
  - Cancelled lessons excluded from busy intervals.
- **Regression:** verify `RescheduleRequestModal` produces identical slots before and after
  the refactor onto `computeOpenSlots`.

## Out of scope (v1)

- Filtering openings by lesson duration.
- Sharing/exporting openings.
- Creating a lesson directly from tapping an open slot.
