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
      // NOTE: useWeeklyBreaks returns only recurring breaks; one-off specific-date
      // breaks are not applied here, consistent with how the calendar renders breaks.
      const breaks: TimeRange[] = (weeklyBreaks.get(dayOfWeek) || []).map((b) => ({
        start: b.start_time,
        end: b.end_time,
      }));

      // On today, hide already-passed start times. Other days render as-is.
      // `now` is captured once per memo run; this screen calls refetch() on focus
      // (see openings.tsx), which re-runs this memo, so the today cutoff stays
      // current in practice without an interval timer.
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
