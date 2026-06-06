# Tutor Weekly Openings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tutors a dedicated, navigable-by-week "Openings" screen that lists the bookable 30-minute open slots per day (availability − booked lessons − breaks), matching exactly what a parent sees in the reschedule flow.

**Architecture:** Extract the slot-generation math currently inlined in `RescheduleRequestModal` into a pure, dependency-free module (`src/lib/openSlots.ts`) that is Deno-testable. A new hook (`useWeekOpenSlots`) composes existing data hooks (`useTutorAvailability`, `useWeekGroupedLessons`, `useWeeklyBreaks`) and the pure module to produce per-day openings in the tutor's timezone. A new pushed route (`app/openings.tsx`) renders them, reachable from a Calendar header button and a More-menu item.

**Tech Stack:** React Native 0.81 + Expo Router 6, TypeScript (strict), Supabase hooks, Deno for unit tests (matches existing `supabase/functions/.../push.test.ts` pattern).

---

## File Structure

**New files:**
- `src/lib/openSlots.ts` — pure slot math (parse/format clock strings, overlap test, slot generation, `computeOpenSlots`). No React/RN/Supabase imports.
- `src/lib/openSlots.test.ts` — Deno unit tests for `src/lib/openSlots.ts`.
- `src/hooks/useWeekOpenSlots.ts` — composes existing data hooks + `openSlots.ts` into per-day openings for a week.
- `app/openings.tsx` — tutor-only screen rendering the week's openings with prev/next/today navigation.

**Modified files:**
- `src/components/RescheduleRequestModal.tsx` — replace inline `parseTimeToMinutes` / `isTimeSlotBusy` / `timeOptionsForSlot` math with calls into `openSlots.ts` (no UX change).
- `app/_layout.tsx` — register `<Stack.Screen name="openings" />`.
- `app/(tabs)/more.tsx` — add tutor-only "Openings" menu item.
- `app/(tabs)/calendar.tsx` — add tutor-only "Openings" header button that pushes `/openings`.

---

## Task 1: Pure slot-math module `openSlots.ts`

**Files:**
- Create: `src/lib/openSlots.ts`
- Test: `src/lib/openSlots.test.ts`

This module is the single source of truth for "given availability windows, busy intervals, and breaks, what 30-minute start times are open?". It is pure (no imports) so Deno can test it directly.

- [ ] **Step 1: Write the failing test**

Create `src/lib/openSlots.test.ts`:

```ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  parseClockToMinutes,
  formatMinutesToClock,
  generateSlotsForWindow,
  computeOpenSlots,
} from './openSlots.ts';

Deno.test('parseClockToMinutes handles HH:MM and HH:MM:SS', () => {
  assertEquals(parseClockToMinutes('09:00'), 540);
  assertEquals(parseClockToMinutes('09:30:00'), 570);
  assertEquals(parseClockToMinutes('00:00'), 0);
});

Deno.test('formatMinutesToClock zero-pads', () => {
  assertEquals(formatMinutesToClock(540), '09:00');
  assertEquals(formatMinutesToClock(570), '09:30');
  assertEquals(formatMinutesToClock(0), '00:00');
});

Deno.test('generateSlotsForWindow: full window free, 30-min steps', () => {
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [],
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: false },
    { time: '10:00', isBusy: false },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('generateSlotsForWindow: a 30-min start is busy when it overlaps a blocked interval', () => {
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [{ start: '09:30', end: '10:00' }],
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },
    { time: '10:00', isBusy: false },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('generateSlotsForWindow: slotDurationMin longer than step blocks earlier starts', () => {
  // 60-min lesson starting 09:30 would run into a 10:00 booking, so 09:30 is busy too.
  const slots = generateSlotsForWindow({
    window: { start: '09:00', end: '11:00' },
    blocked: [{ start: '10:00', end: '10:30' }],
    slotDurationMin: 60,
    granularityMin: 30,
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },
    { time: '10:00', isBusy: true },
    { time: '10:30', isBusy: false },
  ]);
});

Deno.test('computeOpenSlots: availability minus busy minus breaks, deduped and sorted', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '12:00' }],
    busyIntervals: [{ start: '09:00', end: '10:00' }],
    breaks: [{ start: '11:00', end: '11:30' }],
  });
  assertEquals(open, ['10:00', '10:30', '11:30']);
});

Deno.test('computeOpenSlots: fully booked returns empty', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '10:00' }],
    busyIntervals: [{ start: '09:00', end: '10:00' }],
    breaks: [],
  });
  assertEquals(open, []);
});

Deno.test('computeOpenSlots: no availability returns empty', () => {
  const open = computeOpenSlots({
    availabilityWindows: [],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, []);
});

Deno.test('computeOpenSlots: overlapping availability windows do not duplicate starts', () => {
  const open = computeOpenSlots({
    availabilityWindows: [
      { start: '09:00', end: '10:30' },
      { start: '10:00', end: '11:00' },
    ],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, ['09:00', '09:30', '10:00', '10:30']);
});

Deno.test('computeOpenSlots: minStartMinutes hides earlier starts (today filter)', () => {
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '11:00' }],
    busyIntervals: [],
    breaks: [],
    minStartMinutes: 600, // 10:00
  });
  assertEquals(open, ['10:00', '10:30']);
});

Deno.test('computeOpenSlots: window not divisible by granularity drops the partial tail', () => {
  // 09:00-09:45 only fits one full 30-min slot at 09:00 (09:30 would end 10:00 > 09:45).
  const open = computeOpenSlots({
    availabilityWindows: [{ start: '09:00', end: '09:45' }],
    busyIntervals: [],
    breaks: [],
  });
  assertEquals(open, ['09:00']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `deno test src/lib/openSlots.test.ts`
Expected: FAIL — module `./openSlots.ts` not found / exports undefined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/openSlots.ts`:

```ts
/**
 * openSlots — pure slot-availability math.
 *
 * Single source of truth for turning availability windows, busy intervals, and
 * breaks into bookable start times. No React/RN/Supabase imports so it can be
 * unit-tested directly with `deno test`.
 *
 * All time strings are wall-clock "HH:MM" or "HH:MM:SS" (no timezone). Callers
 * are responsible for converting timestamps into the desired timezone's clock
 * time before calling in.
 */

export interface TimeRange {
  start: string; // "HH:MM" or "HH:MM:SS"
  end: string;   // "HH:MM" or "HH:MM:SS"
}

export interface SlotCandidate {
  time: string;  // "HH:MM"
  isBusy: boolean;
}

/** Parse "HH:MM" or "HH:MM:SS" into minutes from midnight. */
export function parseClockToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Format minutes-from-midnight back into a zero-padded "HH:MM". */
export function formatMinutesToClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** True when [aStart, aEnd) and [bStart, bEnd) overlap (minutes). */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** True when a slot [startMin, startMin+durationMin) overlaps any blocked range. */
function isBlocked(
  startMin: number,
  durationMin: number,
  blocked: TimeRange[]
): boolean {
  const endMin = startMin + durationMin;
  for (const range of blocked) {
    if (
      rangesOverlap(
        startMin,
        endMin,
        parseClockToMinutes(range.start),
        parseClockToMinutes(range.end)
      )
    ) {
      return true;
    }
  }
  return false;
}

export interface GenerateSlotsInput {
  /** The availability window to slice. */
  window: TimeRange;
  /** Busy intervals + breaks that make a slot unbookable. */
  blocked: TimeRange[];
  /** Length of the lesson being checked for conflicts. Default 30. */
  slotDurationMin?: number;
  /** Step between candidate start times. Default 30. */
  granularityMin?: number;
  /** Hide candidate starts before this minute-of-day. Default 0. */
  minStartMinutes?: number;
}

/**
 * Generate every candidate start time within a single window, each flagged
 * busy/free. A candidate is included only if a full `slotDurationMin` block
 * fits inside the window. Used by the reschedule modal (which renders busy
 * slots as disabled) and by `computeOpenSlots` (which keeps only free ones).
 */
export function generateSlotsForWindow(input: GenerateSlotsInput): SlotCandidate[] {
  const {
    window,
    blocked,
    slotDurationMin = 30,
    granularityMin = 30,
    minStartMinutes = 0,
  } = input;

  const windowStart = parseClockToMinutes(window.start);
  const windowEnd = parseClockToMinutes(window.end);

  const slots: SlotCandidate[] = [];
  for (
    let mins = windowStart;
    mins + slotDurationMin <= windowEnd;
    mins += granularityMin
  ) {
    if (mins < minStartMinutes) continue;
    slots.push({
      time: formatMinutesToClock(mins),
      isBusy: isBlocked(mins, slotDurationMin, blocked),
    });
  }
  return slots;
}

export interface ComputeOpenSlotsInput {
  availabilityWindows: TimeRange[];
  busyIntervals: TimeRange[];
  breaks: TimeRange[];
  /** Length of the lesson being checked for conflicts. Default 30. */
  slotDurationMin?: number;
  /** Step between candidate start times. Default 30. */
  granularityMin?: number;
  /** Hide candidate starts before this minute-of-day. Default 0. */
  minStartMinutes?: number;
}

/**
 * Free 30-min (by default) start times across all availability windows:
 * availability − busy − breaks. Returns unique "HH:MM" strings, sorted ascending.
 */
export function computeOpenSlots(input: ComputeOpenSlotsInput): string[] {
  const {
    availabilityWindows,
    busyIntervals,
    breaks,
    slotDurationMin = 30,
    granularityMin = 30,
    minStartMinutes = 0,
  } = input;

  const blocked = [...busyIntervals, ...breaks];
  const freeMinutes = new Set<number>();

  for (const window of availabilityWindows) {
    const candidates = generateSlotsForWindow({
      window,
      blocked,
      slotDurationMin,
      granularityMin,
      minStartMinutes,
    });
    for (const candidate of candidates) {
      if (!candidate.isBusy) {
        freeMinutes.add(parseClockToMinutes(candidate.time));
      }
    }
  }

  return Array.from(freeMinutes)
    .sort((a, b) => a - b)
    .map(formatMinutesToClock);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `deno test src/lib/openSlots.test.ts`
Expected: PASS — all `Deno.test` cases ok.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/openSlots.ts src/lib/openSlots.test.ts
git commit -m "feat(openings): add pure slot-math module with Deno tests"
```

---

## Task 2: Refactor `RescheduleRequestModal` onto `openSlots.ts`

**Files:**
- Modify: `src/components/RescheduleRequestModal.tsx` (imports ~line 26-31; `parseTimeToMinutes` ~133-145; `isTimeSlotBusy` ~147-169; `timeOptionsForSlot` ~172-195)
- Test: `src/lib/openSlots.test.ts` (add one regression case)

Goal: the modal produces the **same** slot list as before, but the math now lives in the shared module. The modal still renders busy slots as disabled, so it uses `generateSlotsForWindow` (not `computeOpenSlots`).

- [ ] **Step 1: Add a regression test capturing the modal's prior behavior**

Append to `src/lib/openSlots.test.ts`:

```ts
Deno.test('regression: reschedule modal slot list (busy slots kept as disabled)', () => {
  // Mirrors the modal: a 09:00-12:00 availability window, a 60-min lesson,
  // busy 10:00-11:00 from the busy-slots RPC. The modal renders all four
  // 30-min starts, marking those that conflict with the 60-min lesson busy.
  const slots = generateSlotsForWindow({
    window: { start: '09:00:00', end: '12:00:00' },
    blocked: [{ start: '10:00:00', end: '11:00:00' }],
    slotDurationMin: 60,
    granularityMin: 30,
  });
  assertEquals(slots, [
    { time: '09:00', isBusy: false },
    { time: '09:30', isBusy: true },  // 09:30-10:30 overlaps 10:00-11:00
    { time: '10:00', isBusy: true },
    { time: '10:30', isBusy: true },  // 10:30-11:30 overlaps 10:00-11:00
    { time: '11:00', isBusy: false },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it passes against the module**

Run: `deno test src/lib/openSlots.test.ts`
Expected: PASS (this documents the behavior the modal must keep).

- [ ] **Step 3: Update the modal imports**

In `src/components/RescheduleRequestModal.tsx`, find:

```ts
import {
  useTutorAvailability,
  useBusySlotsForDate,
  DAY_NAMES,
  formatTimeDisplay,
} from '../hooks/useTutorAvailability';
```

Add the module import directly below it:

```ts
import { generateSlotsForWindow, TimeRange } from '../lib/openSlots';
```

- [ ] **Step 4: Delete the inline `parseTimeToMinutes` and `isTimeSlotBusy` helpers**

Remove these two `useCallback` blocks entirely (currently ~lines 132-169):

```ts
  // Helper function to parse time string (HH:MM, HH:MM:SS, or timestamp) to minutes from midnight in LOCAL timezone
  const parseTimeToMinutes = useCallback((timeStr: string): number => {
    // ...
  }, []);

  // Helper function to check if a time slot conflicts with an existing lesson
  const isTimeSlotBusy = useCallback((timeStr: string, durationMin: number = 30) => {
    // ...
  }, [selectedDate, busySlots, parseTimeToMinutes]);
```

- [ ] **Step 5: Replace `timeOptionsForSlot` with a call into the module**

Replace the whole `timeOptionsForSlot` memo (currently ~lines 171-195) with:

```ts
  // Generate 30-minute start times within the selected slot, flagging busy ones.
  // Busy times come from the busy-slots RPC (all booked lessons, not just this
  // parent's). Shared math lives in src/lib/openSlots.ts.
  const timeOptionsForSlot = useMemo(() => {
    if (!selectedSlot) return [];
    const lessonDuration = lesson?.duration_min || 30;
    return generateSlotsForWindow({
      window: { start: selectedSlot.start_time, end: selectedSlot.end_time },
      blocked: busySlots as TimeRange[],
      slotDurationMin: lessonDuration,
      granularityMin: 30,
    });
  }, [selectedSlot, busySlots, lesson?.duration_min]);
```

Note: `busySlots` items are `{ start_time, end_time }` (`BusySlot`), which is **not** assignable to `TimeRange` (`{ start, end }`). Map them. Replace the line above's `blocked` value with a mapped array:

```ts
      blocked: busySlots.map((b) => ({ start: b.start_time, end: b.end_time })),
```

and drop the unused `TimeRange` cast from the import if not otherwise used (keep the `generateSlotsForWindow` import). Final memo:

```ts
  const timeOptionsForSlot = useMemo(() => {
    if (!selectedSlot) return [];
    const lessonDuration = lesson?.duration_min || 30;
    return generateSlotsForWindow({
      window: { start: selectedSlot.start_time, end: selectedSlot.end_time },
      blocked: busySlots.map((b) => ({ start: b.start_time, end: b.end_time })),
      slotDurationMin: lessonDuration,
      granularityMin: 30,
    });
  }, [selectedSlot, busySlots, lesson?.duration_min]);
```

And the import becomes:

```ts
import { generateSlotsForWindow } from '../lib/openSlots';
```

- [ ] **Step 6: Remove the now-unused `useCallback` import if nothing else uses it**

Check the file for remaining `useCallback(` usages. If none remain, change:

```ts
import React, { useState, useEffect, useMemo, useCallback } from 'react';
```

to:

```ts
import React, { useState, useEffect, useMemo } from 'react';
```

(If other `useCallback` usages remain, leave the import as-is.)

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (`timeOptionsForSlot` still returns `{ time, isBusy }[]`, so the JSX rendering it is unchanged.)

- [ ] **Step 8: Commit**

```bash
git add src/components/RescheduleRequestModal.tsx src/lib/openSlots.test.ts
git commit -m "refactor(reschedule): use shared openSlots math, add regression test"
```

---

## Task 3: `useWeekOpenSlots` hook

**Files:**
- Create: `src/hooks/useWeekOpenSlots.ts`

Composes existing data hooks and `computeOpenSlots` into per-day openings for one week, in the tutor's timezone.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useWeekOpenSlots.ts`:

```ts
/**
 * useWeekOpenSlots
 *
 * Computes, for each day of a given week, the tutor's bookable 30-minute open
 * slots = availability (recurring + specific-date) − booked lessons − breaks,
 * in the tutor's configured timezone. Reuses existing data hooks; no new tables
 * or RPCs. The tutor can see all of their own lessons via RLS, so booked times
 * come from useWeekGroupedLessons rather than the parent-facing busy-slots RPC.
 */

import { useCallback, useMemo } from 'react';
import { computeOpenSlots, TimeRange } from '../lib/openSlots';
import { useTutorAvailability } from './useTutorAvailability';
import { useWeekGroupedLessons } from './useLessons';
import { useWeeklyBreaks } from './useTutorBreaks';
import { getDateKeyInTimezone } from './useTutorBranding';
import {
  getWeekDaysInTimezone,
  getDayOfWeekInTimezone,
  formatTimeInTimezone,
  isSameDayInTimezone,
} from '../utils/dateUtils';

export type OpeningsDayState = 'open' | 'fully-booked' | 'no-availability';

export interface DayOpenings {
  date: Date;
  dayOfWeek: number;       // 0=Sun .. 6=Sat (in tutor tz)
  dayLabel: string;        // e.g. "Mon Jun 8"
  slots: string[];         // free "HH:MM" start times
  state: OpeningsDayState;
}

export interface UseWeekOpenSlotsResult {
  days: DayOpenings[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function formatDayLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function useWeekOpenSlots(
  tutorId: string | undefined,
  weekStart: Date,
  timezone: string
): UseWeekOpenSlotsResult {
  const {
    data: availability,
    loading: availabilityLoading,
    error: availabilityError,
    refetch: refetchAvailability,
  } = useTutorAvailability({ tutorId });

  const {
    data: groupedLessons,
    loading: lessonsLoading,
    error: lessonsError,
    refetch: refetchLessons,
  } = useWeekGroupedLessons(weekStart, timezone);

  const {
    data: weeklyBreaks,
    loading: breaksLoading,
    error: breaksError,
    refetch: refetchBreaks,
  } = useWeeklyBreaks(tutorId);

  const days = useMemo<DayOpenings[]>(() => {
    const weekDays = getWeekDaysInTimezone(weekStart, timezone);
    const now = new Date();

    return weekDays.map((date) => {
      const dayOfWeek = getDayOfWeekInTimezone(date, timezone);
      const dayKey = getDateKeyInTimezone(date.toISOString(), timezone);

      // Availability windows for this date: recurring (by day-of-week) unioned
      // with specific-date rows. Matches useAvailableSlotsForDate semantics.
      const availabilityWindows: TimeRange[] = availability
        .filter((slot) =>
          (slot.is_recurring && slot.day_of_week === dayOfWeek) ||
          (!slot.is_recurring && slot.specific_date === dayKey)
        )
        .map((slot) => ({ start: slot.start_time, end: slot.end_time }));

      // Booked lessons on this date (exclude cancelled), as tutor-tz clock ranges.
      const busyIntervals: TimeRange[] = groupedLessons
        .filter(
          (group) =>
            group.status !== 'cancelled' &&
            getDateKeyInTimezone(group.scheduled_at, timezone) === dayKey
        )
        .map((group) => ({
          start: formatTimeInTimezone(new Date(group.scheduled_at), timezone),
          end: formatTimeInTimezone(new Date(group.end_time), timezone),
        }));

      // Recurring breaks for this day-of-week (matches calendar's getBreaksForDate).
      const breaks: TimeRange[] = (weeklyBreaks.get(dayOfWeek) || []).map((b) => ({
        start: b.start_time,
        end: b.end_time,
      }));

      // On today, hide already-passed start times. Other days render as-is.
      const minStartMinutes = isSameDayInTimezone(date, now, timezone)
        ? parseClockNow(now, timezone)
        : 0;

      const slots = computeOpenSlots({
        availabilityWindows,
        busyIntervals,
        breaks,
        minStartMinutes,
      });

      const state: OpeningsDayState =
        availabilityWindows.length === 0
          ? 'no-availability'
          : slots.length === 0
          ? 'fully-booked'
          : 'open';

      return {
        date,
        dayOfWeek,
        dayLabel: formatDayLabel(date, timezone),
        slots,
        state,
      };
    });
  }, [availability, groupedLessons, weeklyBreaks, weekStart, timezone]);

  const refetch = useCallback(async () => {
    await Promise.all([refetchAvailability(), refetchLessons(), refetchBreaks()]);
  }, [refetchAvailability, refetchLessons, refetchBreaks]);

  return {
    days,
    loading: availabilityLoading || lessonsLoading || breaksLoading,
    error: availabilityError || lessonsError || breaksError,
    refetch,
  };
}

/** Current wall-clock time as minutes-from-midnight in the given timezone. */
function parseClockNow(now: Date, timezone: string): number {
  const [h, m] = formatTimeInTimezone(now, timezone).split(':').map(Number);
  return h * 60 + m;
}
```

- [ ] **Step 2: Fix the React import casing**

`useCallback` and `useMemo` come from `react` (lowercase `u`). Correct the import line to:

```ts
import { useCallback, useMemo } from 'react';
```

(It is already written that way above — verify it reads `useCallback, useMemo`, not `useCallBack`.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Confirms `useWeekGroupedLessons`, `useWeeklyBreaks`, `getDateKeyInTimezone`, and the `dateUtils` helpers resolve and the `GroupedLesson` fields (`status`, `scheduled_at`, `end_time`) and `TutorBreak`/`TutorAvailability` fields (`start_time`, `end_time`, `is_recurring`, `day_of_week`, `specific_date`) match.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeekOpenSlots.ts
git commit -m "feat(openings): add useWeekOpenSlots hook"
```

---

## Task 4: `app/openings.tsx` screen + route registration

**Files:**
- Create: `app/openings.tsx`
- Modify: `app/_layout.tsx` (Stack screen list, ~after line 159 `availability` screen)

- [ ] **Step 1: Create the screen**

Create `app/openings.tsx`:

```tsx
/**
 * Openings screen (tutor-only)
 *
 * Lists bookable 30-minute open slots per day for a navigable week, so a tutor
 * can instantly answer "do you have anything open?" when a parent asks to
 * reschedule. Slots match what a parent sees in RescheduleRequestModal.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useTutorBranding, DEFAULT_TIMEZONE } from '../src/hooks/useTutorBranding';
import {
  getWeekStartInTimezone,
  addDaysInTimezone,
} from '../src/utils/dateUtils';
import { useWeekOpenSlots, DayOpenings } from '../src/hooks/useWeekOpenSlots';
import { formatTimeDisplay } from '../src/hooks/useTutorAvailability';

function formatWeekRange(days: DayOpenings[], timezone: string): string {
  if (days.length === 0) return '';
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
    }).format(d);
  return `${fmt(days[0].date)} – ${fmt(days[days.length - 1].date)}`;
}

export default function OpeningsScreen() {
  const { isTutor, parent } = useAuthContext();
  const { data: tutorBranding } = useTutorBranding();
  const timezone = tutorBranding?.timezone || DEFAULT_TIMEZONE;

  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStartInTimezone(new Date(), DEFAULT_TIMEZONE)
  );
  const [refreshing, setRefreshing] = useState(false);

  const { days, loading, error, refetch } = useWeekOpenSlots(
    parent?.id,
    weekStart,
    timezone
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const goToPreviousWeek = () =>
    setWeekStart((w) => addDaysInTimezone(w, -7, timezone));
  const goToNextWeek = () =>
    setWeekStart((w) => addDaysInTimezone(w, 7, timezone));
  const goToThisWeek = () =>
    setWeekStart(getWeekStartInTimezone(new Date(), timezone));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Tutor-only screen.
  if (!isTutor) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable style={styles.navButton} onPress={goToPreviousWeek}>
          <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
        </Pressable>
        <Pressable style={styles.weekRange} onPress={goToThisWeek}>
          <Text style={styles.weekRangeText}>{formatWeekRange(days, timezone)}</Text>
          <Text style={styles.weekRangeHint}>Tap for this week</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={goToNextWeek}>
          <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
        </Pressable>
      </View>

      {loading && days.every((d) => d.slots.length === 0) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Couldn't load openings. Pull to retry.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {days.map((day) => (
            <View key={day.dayLabel} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                {day.state === 'open' && (
                  <Text style={styles.slotCount}>
                    {day.slots.length} open
                  </Text>
                )}
              </View>

              {day.state === 'no-availability' ? (
                <Text style={styles.emptyText}>No availability set</Text>
              ) : day.state === 'fully-booked' ? (
                <Text style={styles.emptyText}>Fully booked</Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {day.slots.map((time) => (
                    <View key={time} style={styles.slotChip}>
                      <Text style={styles.slotChipText}>{formatTimeDisplay(time)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  navButton: {
    padding: spacing.sm,
  },
  weekRange: {
    flex: 1,
    alignItems: 'center',
  },
  weekRangeText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  weekRangeHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing.base,
    gap: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  slotCount: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  slotChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
});
```

- [ ] **Step 2: Register the route in the root Stack**

In `app/_layout.tsx`, immediately after the `availability` `<Stack.Screen>` block (ends ~line 159), add:

```tsx
      <Stack.Screen
        name="openings"
        options={{
          headerShown: true,
          headerTitle: 'Openings',
          headerBackTitle: 'Back',
        }}
      />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Verify `colors.status.error`, `colors.primary.subtle`, `shadows.sm`, and the `typography`/`spacing` keys used all exist — they are all used elsewhere in `calendar.tsx`/`RescheduleRequestModal.tsx`, so they resolve.)

- [ ] **Step 4: Commit**

```bash
git add app/openings.tsx app/_layout.tsx
git commit -m "feat(openings): add tutor Openings screen and route"
```

---

## Task 5: Entry points (Calendar header button + More menu item)

**Files:**
- Modify: `app/(tabs)/more.tsx` (`menuItems` array, ~after the `availability` entry at lines 52-59)
- Modify: `app/(tabs)/calendar.tsx` (imports; `headerButtons` group ~lines 826-851)

- [ ] **Step 1: Add the More-menu item**

In `app/(tabs)/more.tsx`, insert this object into `menuItems` immediately after the `availability` entry (after line 59's closing `},`):

```ts
  {
    key: 'openings',
    label: 'Openings',
    icon: 'calendar-clear',
    href: '/openings',
    description: 'See your open slots this week',
    tutorOnly: true,
  },
```

- [ ] **Step 2: Verify the More item routes correctly**

Run: `npm run typecheck`
Expected: no errors. (`href` is pushed via the existing `handleItemPress` → `router.push(href)`, and `tutorOnly` is already honored by `filteredItems`.)

- [ ] **Step 3: Add the `router` import to the calendar**

`app/(tabs)/calendar.tsx` does not currently import `router`. Add it near the other imports (e.g. directly under the React import on line 6):

```ts
import { router } from 'expo-router';
```

- [ ] **Step 4: Add the Openings header button (tutor-only)**

In `app/(tabs)/calendar.tsx`, inside the `isTutor && (...)` header block, add an Openings button as the first child of the `styles.headerButtons` `View` (before the `Select` `Pressable` at line 827):

```tsx
              <Pressable
                style={styles.openingsButton}
                onPress={() => router.push('/openings')}
              >
                <Ionicons name="calendar-clear-outline" size={20} color={colors.primary.main} />
                <Text style={styles.openingsButtonText}>Openings</Text>
              </Pressable>
```

- [ ] **Step 5: Add the button styles**

In the `StyleSheet.create({ ... })` for `calendar.tsx`, add these entries next to `headerButtons` (~line 1703):

```ts
  openingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  openingsButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
```

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. Confirm `borderRadius` is already imported in `calendar.tsx` (it is — line 21 imports `borderRadius`).

- [ ] **Step 7: Commit**

```bash
git add app/\(tabs\)/more.tsx app/\(tabs\)/calendar.tsx
git commit -m "feat(openings): add entry points from Calendar and More menu"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated checks**

Run: `deno test src/lib/openSlots.test.ts && npm run typecheck && npm run lint`
Expected: Deno tests all pass; no TypeScript errors; no lint errors.

- [ ] **Step 2: Manual smoke test (tutor account)**

Run: `npm run web` (or `npm start`), log in as a tutor, then verify:
  1. Calendar header shows an **Openings** button; tapping it opens the Openings screen with a native "Openings" header + back button.
  2. More tab shows an **Openings** item (tutor only); tapping it opens the same screen.
  3. The current week shows each day with: open 30-min chips, "Fully booked", or "No availability set" as appropriate.
  4. Prev/next arrows move the week; tapping the week range resets to this week.
  5. For **today**, already-passed times are not shown; a day earlier in the week still shows all its slots.
  6. Cross-check one day against the Calendar: the open chips fall in the gaps between booked lessons and breaks.
  7. Open the parent reschedule flow (parent account) for a lesson and confirm the time options still render busy slots struck-through exactly as before (modal refactor regression).

- [ ] **Step 3: Final commit (if any manual-fix tweaks were needed)**

```bash
git add -A
git commit -m "chore(openings): verification fixes"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** dedicated Openings screen (Task 4); bookable 30-min slots (Task 1 `computeOpenSlots`, granularity 30); navigable weeks (Task 4 nav); both entry points (Task 5); shared math with reschedule modal (Tasks 1-2); timezone via `useTutorBranding` (Tasks 3-4); edge states no-availability/fully-booked/open + today's passed-slot hiding + specific-date union (Task 3); Deno tests (Tasks 1-2). All spec sections map to a task.
- **Type consistency:** `TimeRange { start, end }`, `SlotCandidate { time, isBusy }`, `DayOpenings`, and `OpeningsDayState` are used identically across module, hook, and screen. `BusySlot { start_time, end_time }` is explicitly mapped to `TimeRange` in both the modal (Task 2 Step 5) and the hook (Task 3).
- **No new backend:** reuses `useTutorAvailability`, `useWeekGroupedLessons`, `useWeeklyBreaks`, `getDateKeyInTimezone`, and `dateUtils`; no migrations or RPCs.
