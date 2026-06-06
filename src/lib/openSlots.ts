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

/**
 * Parse "HH:MM" or "HH:MM:SS" into minutes from midnight.
 * Input is assumed well-formed; a seconds component is ignored (minute
 * granularity only), and malformed input yields NaN rather than throwing.
 */
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
 * busy/free. Used by the reschedule modal (which renders busy slots as
 * disabled) and by `computeOpenSlots` (which keeps only free ones).
 *
 * Candidate emission is bounded by `granularityMin`: a start is emitted while a
 * full granularity step still fits in the window. `slotDurationMin` affects only
 * busy-overlap detection (does a lesson of that length collide with a blocked
 * range?), NOT whether the start fits the window. So when
 * `slotDurationMin > granularityMin`, a returned free start may run past the
 * window end. This is intentional: it preserves parity with the reschedule
 * flow, which offers 30-min starts up to the window end regardless of lesson
 * length. The openings screen always uses 30/30, so the overrun never arises
 * there.
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
    mins + granularityMin <= windowEnd;
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
