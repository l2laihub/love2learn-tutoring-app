/**
 * Timezone-aware date utilities for DST-safe date arithmetic.
 * All functions use Intl.DateTimeFormat to correctly handle DST transitions.
 */

/**
 * Extract date/time parts in a specific timezone using Intl.DateTimeFormat.
 */
export function getPartsInTimezone(date: Date, timezone: string) {
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
export function dateFromTimezone(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  timezone: string
): Date {
  // Step 1: Create a rough UTC estimate (treat wall-clock values as if they were UTC)
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Step 2: Find what the timezone thinks this UTC instant is
  const parts = getPartsInTimezone(rough, timezone);

  // Step 3: Compute the UTC offset by comparing what we want vs what the timezone shows.
  // Build a UTC date from the timezone parts to get the offset as a clean ms difference.
  // This avoids the month-boundary day-diff issue entirely.
  const roughInTz = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  const offsetMs = rough.getTime() - roughInTz.getTime();

  // Step 4: Apply offset — this shifts rough by the timezone's UTC offset
  const adjusted = new Date(rough.getTime() + offsetMs);

  // Step 5: Verify and correct for DST edge cases (e.g., spring-forward gap)
  const verify = getPartsInTimezone(adjusted, timezone);
  if (verify.hour !== hour || verify.minute !== minute) {
    const finalDiffMs = ((hour - verify.hour) * 60 + (minute - verify.minute)) * 60 * 1000;
    return new Date(adjusted.getTime() + finalDiffMs);
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
  // Normalize via Date.UTC to handle month boundary (e.g., day 1 - 3 = day -2)
  const resolved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - daysFromMonday));
  return dateFromTimezone(
    resolved.getUTCFullYear(), resolved.getUTCMonth() + 1, resolved.getUTCDate(),
    0, 0, 0, timezone
  );
}

/**
 * Add N days to a date, preserving wall-clock time in the given timezone.
 * This avoids the 23h/25h day problem around DST transitions.
 */
export function addDaysInTimezone(date: Date, days: number, timezone: string): Date {
  const parts = getPartsInTimezone(date, timezone);
  // Use Date.UTC to resolve overflow days (e.g., March 33 → April 2),
  // then extract the normalized year/month/day before calling dateFromTimezone.
  // This prevents dateFromTimezone from getting confused by large day-diff values.
  const resolved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  const resolvedYear = resolved.getUTCFullYear();
  const resolvedMonth = resolved.getUTCMonth() + 1;
  const resolvedDay = resolved.getUTCDate();
  return dateFromTimezone(
    resolvedYear, resolvedMonth, resolvedDay,
    parts.hour, parts.minute, parts.second, timezone
  );
}

/**
 * Get UTC ISO strings for the start and end of a 7-day week in the given timezone.
 * weekStart should be the Monday at 00:00 in the timezone.
 */
export function getWeekQueryRange(weekStart: Date, timezone: string): { startISO: string; endISO: string } {
  const start = weekStart;
  const endDate = addDaysInTimezone(weekStart, 6, timezone);
  const endParts = getPartsInTimezone(endDate, timezone);
  const end = dateFromTimezone(endParts.year, endParts.month, endParts.day, 23, 59, 59, timezone);
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

/**
 * Get the day of the month for a Date in a specific timezone.
 */
export function getDayInTimezone(date: Date, timezone: string): number {
  return getPartsInTimezone(date, timezone).day;
}

/**
 * Get the day of week (0=Sun, 6=Sat) for a Date in a specific timezone.
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
  };
  return dayMap[formatter.format(date)] ?? date.getDay();
}

/**
 * Format a Date's time as "HH:MM" in a specific timezone.
 */
export function formatTimeInTimezone(date: Date, timezone: string): string {
  const parts = getPartsInTimezone(date, timezone);
  return `${parts.hour.toString().padStart(2, '0')}:${parts.minute.toString().padStart(2, '0')}`;
}

/**
 * Check if two Dates fall on the same calendar day in a specific timezone.
 */
export function isSameDayInTimezone(a: Date, b: Date, timezone: string): boolean {
  const pa = getPartsInTimezone(a, timezone);
  const pb = getPartsInTimezone(b, timezone);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}
