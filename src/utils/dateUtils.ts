/**
 * Timezone-aware date utilities for DST-safe date arithmetic.
 * All functions use Intl.DateTimeFormat to correctly handle DST transitions.
 */

/**
 * Extract date/time parts in a specific timezone using Intl.DateTimeFormat.
 */
function getPartsInTimezone(date: Date, timezone: string) {
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
 * Create a Date (UTC) that corresponds to the given wall-clock time in a timezone.
 * E.g., dateFromTimezone(2026, 3, 9, 0, 0, 0, 'America/Los_Angeles')
 * returns the UTC instant for midnight PDT on March 9, 2026.
 */
function dateFromTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string
): Date {
  // Create a rough UTC estimate, then adjust by comparing what Intl reports
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Get what timezone thinks this UTC instant is
  const parts = getPartsInTimezone(rough, timezone);
  const diffHours = hour - parts.hour;
  const diffMinutes = minute - parts.minute;
  const diffDays = day - parts.day;

  // Adjust for day wraparound
  let totalMinutesDiff = diffDays * 24 * 60 + diffHours * 60 + diffMinutes;
  // Handle month boundary (e.g., day=1 vs parts.day=31)
  if (diffDays > 15) totalMinutesDiff -= 28 * 24 * 60; // went back a month
  if (diffDays < -15) totalMinutesDiff += 28 * 24 * 60; // went forward a month

  const adjusted = new Date(rough.getTime() + totalMinutesDiff * 60 * 1000);

  // Verify and do one more correction if needed (handles edge cases)
  const verify = getPartsInTimezone(adjusted, timezone);
  if (verify.hour !== hour || verify.minute !== minute || verify.day !== day) {
    const finalDiff = (hour - verify.hour) * 60 + (minute - verify.minute);
    return new Date(adjusted.getTime() + finalDiff * 60 * 1000);
  }

  return adjusted;
}

/**
 * Get the Monday of the week containing `date`, at 00:00:00 in the given timezone.
 */
export function getWeekStartInTimezone(date: Date, timezone: string): Date {
  const parts = getPartsInTimezone(date, timezone);
  // Get day of week in timezone (using a temporary date)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const weekday = formatter.format(date);
  const dayMap: Record<string, number> = {
    'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6,
  };
  const daysFromMonday = dayMap[weekday] ?? 0;

  // Subtract days to get to Monday, then set to midnight in timezone
  const mondayDay = parts.day - daysFromMonday;
  return dateFromTimezone(parts.year, parts.month, mondayDay, 0, 0, 0, timezone);
}

/**
 * Add N days to a date, preserving wall-clock time in the given timezone.
 * This avoids the 23h/25h day problem around DST transitions.
 */
export function addDaysInTimezone(date: Date, days: number, timezone: string): Date {
  const parts = getPartsInTimezone(date, timezone);
  return dateFromTimezone(
    parts.year, parts.month, parts.day + days,
    parts.hour, parts.minute, parts.second, timezone
  );
}

/**
 * Get UTC ISO strings for the start and end of a 7-day week in the given timezone.
 * weekStart should be the Monday at 00:00 in the timezone.
 */
export function getWeekQueryRange(weekStart: Date, timezone: string): { startISO: string; endISO: string } {
  const parts = getPartsInTimezone(weekStart, timezone);
  const start = dateFromTimezone(parts.year, parts.month, parts.day, 0, 0, 0, timezone);
  const end = dateFromTimezone(parts.year, parts.month, parts.day + 6, 23, 59, 59, timezone);
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

/**
 * Generate 7 Date objects (Mon-Sun) at midnight in the given timezone.
 */
export function getWeekDaysInTimezone(weekStart: Date, timezone: string): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysInTimezone(weekStart, i, timezone));
  }
  return days;
}
