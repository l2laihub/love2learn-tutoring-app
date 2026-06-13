/**
 * Pure helpers for expanding a recurrence selection into individual lesson dates.
 *
 * Recurrence is never persisted; the Schedule Lesson form picks a RecurrenceType
 * and the calendar screen expands it into one scheduled_lessons row per date.
 *
 * No React/RN/Supabase imports so it can be unit-tested with Deno
 * (see recurrence.test.ts), same self-contained pattern as lessonSeries.ts.
 * The timezone helpers below mirror src/utils/dateUtils.ts and are DST-safe
 * (they preserve wall-clock time across PST/PDT-style transitions).
 */

export type RecurrenceType =
  | 'none'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'monthly_by_week';

// ---------------------------------------------------------------------------
// Timezone-safe date helpers (inlined; mirror src/utils/dateUtils.ts)
// ---------------------------------------------------------------------------

interface DateParts {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getPartsInTimezone(date: Date, timezone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Create a Date (UTC instant) for the given wall-clock time in a timezone,
 * correcting for DST edge cases.
 */
function dateFromTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string
): Date {
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const parts = getPartsInTimezone(rough, timezone);
  const roughInTz = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const offsetMs = rough.getTime() - roughInTz.getTime();
  const adjusted = new Date(rough.getTime() + offsetMs);

  const verify = getPartsInTimezone(adjusted, timezone);
  if (verify.hour !== hour || verify.minute !== minute) {
    const finalDiffMs = ((hour - verify.hour) * 60 + (minute - verify.minute)) * 60 * 1000;
    return new Date(adjusted.getTime() + finalDiffMs);
  }
  return adjusted;
}

/** Add N days, preserving wall-clock time in the timezone (DST-safe). */
function addDaysInTimezone(date: Date, days: number, timezone: string): Date {
  const parts = getPartsInTimezone(date, timezone);
  const resolved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return dateFromTimezone(
    resolved.getUTCFullYear(), resolved.getUTCMonth() + 1, resolved.getUTCDate(),
    parts.hour, parts.minute, parts.second, timezone
  );
}

/** Day of week (0=Sun .. 6=Sat) for a Date in the timezone. */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayMap[formatter.format(date)] ?? date.getDay();
}

/** Number of days in a 1-based month. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Resolve the calendar day for the Nth occurrence of `weekday` in a month.
 * ordinal 1-4 = that occurrence; 5 = the last occurrence in the month.
 * Returns null only if a 1-4 occurrence does not exist (defensive; months
 * always contain at least four of each weekday).
 */
function nthWeekdayDay(year: number, month: number, weekday: number, ordinal: number): number | null {
  const dim = daysInMonth(year, month);

  if (ordinal === 5) {
    const lastDow = getDayOfWeekInTimezone(new Date(Date.UTC(year, month - 1, dim)), 'UTC');
    return dim - ((lastDow - weekday + 7) % 7);
  }

  const firstDow = getDayOfWeekInTimezone(new Date(Date.UTC(year, month - 1, 1)), 'UTC');
  const day = 1 + ((weekday - firstDow + 7) % 7) + (ordinal - 1) * 7;
  return day <= dim ? day : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Expand a recurrence selection into the list of lesson start Dates.
 *
 * - none: just the start date.
 * - weekly / biweekly: step 7 / 14 days from the start, including the anchor.
 * - monthly: same day-of-month each month, including the anchor.
 * - monthly_by_week: the Nth-weekday-of-month occurrences for the selected
 *   `weeks` ordinals (1-4 = 1st..4th, 5 = last), on the same weekday and
 *   wall-clock time as the start date. Occurrences earlier than the start are
 *   excluded; the anchor is included only when its own ordinal is selected.
 *
 * All results are <= endDate, deduplicated, and sorted ascending.
 */
export function generateRecurringDates(
  startDate: Date,
  type: RecurrenceType,
  endDate: Date,
  timezone: string,
  weeks?: number[],
): Date[] {
  if (type === 'none') return [startDate];

  if (type === 'monthly_by_week') {
    const ordinals = Array.from(new Set(weeks ?? [])).filter(w => w >= 1 && w <= 5);
    if (ordinals.length === 0) return [];

    const startParts = getPartsInTimezone(startDate, timezone);
    const weekday = getDayOfWeekInTimezone(startDate, timezone);
    const { hour, minute, second } = startParts;

    const out: Date[] = [];
    let year = startParts.year;
    let month = startParts.month; // 1-based

    // Walk forward month by month until the month's first day passes endDate.
    for (let guard = 0; guard < 600; guard++) {
      const firstOfMonth = dateFromTimezone(year, month, 1, 0, 0, 0, timezone);
      if (firstOfMonth.getTime() > endDate.getTime()) break;

      for (const ordinal of ordinals) {
        const day = nthWeekdayDay(year, month, weekday, ordinal);
        if (day === null) continue;
        const occurrence = dateFromTimezone(year, month, day, hour, minute, second, timezone);
        if (occurrence.getTime() >= startDate.getTime() && occurrence.getTime() <= endDate.getTime()) {
          out.push(occurrence);
        }
      }

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    const seen = new Set<number>();
    return out
      .filter(d => (seen.has(d.getTime()) ? false : seen.add(d.getTime())))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  // weekly / biweekly / monthly: step from the anchor, including it.
  const dates: Date[] = [startDate];
  let current = startDate;

  for (let guard = 0; guard < 2000; guard++) {
    if (type === 'monthly') {
      const parts = getPartsInTimezone(current, timezone);
      // parts.month is 1-based; passing it as Date.UTC's 0-based month advances one month.
      const resolved = new Date(Date.UTC(parts.year, parts.month, parts.day));
      current = dateFromTimezone(
        resolved.getUTCFullYear(), resolved.getUTCMonth() + 1, resolved.getUTCDate(),
        parts.hour, parts.minute, parts.second, timezone
      );
    } else {
      current = addDaysInTimezone(current, type === 'biweekly' ? 14 : 7, timezone);
    }

    if (current.getTime() > endDate.getTime()) break;
    dates.push(current);
  }

  return dates;
}
