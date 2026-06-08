// Pure, dependency-free helpers for the weekly recap. Unit-tested in recap.test.ts.
// calculateLessonAmount is a faithful port of calculateLessonAmountWithDetails
// in src/hooks/usePayments.ts — keep the two in sync (the tests pin the values).

export interface SubjectRateConfig {
  rate: number;
  base_duration: number;
  duration_prices?: Record<string, number>;
}
export interface TutorRateSettings {
  default_rate?: number | null;
  default_base_duration?: number | null;
  subject_rates?: Record<string, SubjectRateConfig> | null;
  combined_session_rate?: number | null;
}

export function calculateLessonAmount(
  settings: TutorRateSettings | null,
  subject: string,
  durationMin: number,
  _isCombinedSession: boolean,
  overrideAmount?: number | null,
): number {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  if (overrideAmount !== undefined && overrideAmount !== null) {
    return overrideAmount;
  }

  const subjectRates = settings?.subject_rates ?? undefined;
  let rate: number;
  let baseDuration: number;

  const rateConfig = subjectRates ? subjectRates[subject] : undefined;
  if (rateConfig && rateConfig.rate > 0 && rateConfig.base_duration > 0) {
    const durationPrices = rateConfig.duration_prices;
    if (durationPrices && typeof durationPrices === 'object') {
      const explicit = durationPrices[String(durationMin)];
      if (typeof explicit === 'number' && explicit > 0) {
        return explicit;
      }
    }
    rate = rateConfig.rate;
    baseDuration = rateConfig.base_duration;
  } else {
    rate = settings?.default_rate ?? defaultRate;
    baseDuration = settings?.default_base_duration ?? defaultBaseDuration;
  }

  return (durationMin / baseDuration) * rate;
}

// Given a local Saturday Date, return the Sun..Fri window of the week ending today.
// weekStart = the Sunday (date string), weekEndExclusive = the Saturday (date string).
// Window is [weekStart 00:00, weekEndExclusive 00:00) → covers Sun through Fri.
export function weekWindowForSaturday(localSaturday: Date): {
  weekStart: string;
  weekEndExclusive: string;
} {
  const sat = new Date(localSaturday);
  sat.setHours(0, 0, 0, 0);
  const sunday = new Date(sat);
  sunday.setDate(sat.getDate() - 6); // Sat - 6 = Sunday
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { weekStart: fmt(sunday), weekEndExclusive: fmt(sat) };
}

// Convert a local calendar date's 00:00:00 in `timeZone` to the equivalent
// absolute instant as a UTC ISO string. Used to filter TIMESTAMPTZ columns by a
// tutor-local date window (PostgREST compares naive timestamps in the DB's UTC
// session tz, which would otherwise shift the window by the tutor's offset).
export function localDateStartToUtcISO(dateStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const asUtc = new Date(utcGuess);
  const tzShown = new Date(asUtc.toLocaleString('en-US', { timeZone }));
  const utcShown = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = tzShown.getTime() - utcShown.getTime();
  return new Date(utcGuess - offsetMs).toISOString();
}

export interface RecapLesson {
  date: string;       // 'Mon Jun 1'
  studentName: string;
  subjectLabel: string;
  status: string;     // 'scheduled' | 'completed' | 'cancelled'
}

export interface RecapData {
  rangeLabel: string;
  lessons: RecapLesson[];
  received: number;
  outstanding: number;
  expected: number;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildRecapMessage(d: RecapData): string {
  const header = `📚 <b>Your week, ${escapeHtml(d.rangeLabel)}</b>`;

  if (d.lessons.length === 0 && d.received === 0 && d.outstanding === 0 && d.expected === 0) {
    return `${header}\n\nNo classes scheduled this week 🌿\nEnjoy the quiet — see you next week!`;
  }

  const statusMark: Record<string, string> = {
    completed: '✅',
    cancelled: '❌',
    scheduled: '•',
  };
  const lessonLines = d.lessons.length
    ? d.lessons
        .map(
          (l) =>
            `${statusMark[l.status] ?? '•'} ${escapeHtml(l.date)} — ${escapeHtml(
              l.studentName,
            )} · ${escapeHtml(l.subjectLabel)}`,
        )
        .join('\n')
    : '<i>No classes this week.</i>';

  return [
    header,
    '',
    `<b>Classes (${d.lessons.length})</b>`,
    lessonLines,
    '',
    '<b>Payments</b>',
    `💰 Received this week: ${money(d.received)}`,
    `⏳ Outstanding / overdue: ${money(d.outstanding)}`,
    `📈 Expected from this week's classes: ${money(d.expected)}`,
  ].join('\n');
}
