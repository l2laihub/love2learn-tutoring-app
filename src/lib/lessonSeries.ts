/**
 * Pure helpers for recurring lesson series detection.
 * Series membership is heuristic: lessons match when they share the same
 * day of week and time of day (in the tutor's timezone).
 *
 * No React/RN/Supabase imports so it can be unit-tested with Deno
 * (see lessonSeries.test.ts), same pattern as openSlots.ts.
 */

export interface SeriesCandidate {
  id: string;
  scheduled_at: string;
}

const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  return DAY_MAP[formatter.format(date)] ?? date.getDay();
}

function formatTimeInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  // Intl can return "24" for midnight with hour12: false
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

/**
 * Filter candidate lessons down to the recurring series of the anchor lesson,
 * using "this and following" semantics: occurrences earlier than the anchor
 * are excluded so series edits/deletes never touch past lessons.
 */
export function filterSeriesLessonIds(
  candidates: SeriesCandidate[],
  anchor: { scheduled_at: string },
  timezone: string
): string[] {
  const anchorDate = new Date(anchor.scheduled_at);
  const anchorTime = anchorDate.getTime();
  const dayOfWeek = getDayOfWeekInTimezone(anchorDate, timezone);
  const timeString = formatTimeInTimezone(anchorDate, timezone);

  return candidates
    .filter(candidate => {
      const d = new Date(candidate.scheduled_at);
      if (d.getTime() < anchorTime) return false;
      return (
        getDayOfWeekInTimezone(d, timezone) === dayOfWeek &&
        formatTimeInTimezone(d, timezone) === timeString
      );
    })
    .map(candidate => candidate.id);
}
