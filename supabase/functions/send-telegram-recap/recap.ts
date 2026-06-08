// Pure, dependency-free helpers for the weekly recap. Unit-tested in recap.test.ts.

// Lesson-amount math is shared with other Edge Functions.
export {
  calculateLessonAmount,
  type SubjectRateConfig,
  type TutorRateSettings,
} from '../_shared/lessonAmount.ts';

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
  paid?: boolean;     // shown only for completed lessons
}

export interface RecapData {
  rangeLabel: string;
  lessons: RecapLesson[];
  received: number;
  outstanding: number;
  expected: number;
  autoMarked?: number;
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
        .map((l) => {
          const mark = statusMark[l.status] ?? '•';
          const money = l.status === 'completed' && l.paid ? ' 💵' : '';
          return `${mark} ${escapeHtml(l.date)} — ${escapeHtml(
            l.studentName,
          )} · ${escapeHtml(l.subjectLabel)}${money}`;
        })
        .join('\n')
    : '<i>No classes this week.</i>';

  return [
    header,
    '',
    `<b>Classes (${d.lessons.length})</b>`,
    lessonLines,
    ...(d.autoMarked && d.autoMarked > 0 ? [`<i>${d.autoMarked} auto-marked this week</i>`] : []),
    '',
    '<b>Payments</b>',
    `💰 Received this week: ${money(d.received)}`,
    `⏳ Outstanding / overdue: ${money(d.outstanding)}`,
    `📈 Expected from this week's classes: ${money(d.expected)}`,
  ].join('\n');
}
