/**
 * Derived prepaid usage.
 *
 * `sessions_used` is no longer a stored counter mutated on lesson complete/uncomplete —
 * it is computed here by counting the completed lessons that fall under a prepaid
 * package's scope for a month. This makes the number self-healing (deleting/editing a
 * completed lesson is reflected automatically) and auditable (the backing lessons are
 * returned, not just a total).
 *
 * The membership rule lives in `lessonCountsTowardPrepaid` (pure, unit-tested in
 * prepaidCoverage.test.ts); this module just gathers the month's completed lessons and
 * applies it.
 */
import { supabase } from './supabase';
import { lessonCountsTowardPrepaid } from './prepaidCoverage';

export interface PrepaidUsageLesson {
  id: string;
  scheduledAt: string;
  subject: string;
  studentName: string;
}

export interface PrepaidUsage {
  /** Number of completed lessons drawing from this package this month. */
  count: number;
  /** The backing lessons, oldest first — for an auditable breakdown. */
  lessons: PrepaidUsageLesson[];
}

export interface PrepaidUsageParams {
  parentId: string;
  /** First of the month, 'YYYY-MM-DD' (as produced by getMonthStart). */
  monthStart: string;
  /** The prepaid row's subject (lowercased) for a per-subject package, or null for legacy all-subjects. */
  paymentSubject: string | null;
  /** Family's per-subject prepaid config (lowercased). */
  prepaidSubjects: string[];
}

const EMPTY: PrepaidUsage = { count: 0, lessons: [] };

export async function fetchPrepaidSessionsUsed(params: PrepaidUsageParams): Promise<PrepaidUsage> {
  const { parentId, monthStart, paymentSubject, prepaidSubjects } = params;

  // Exclusive upper bound = first of next month. Parse the 'YYYY-MM-DD' string directly
  // (not via new Date(), which shifts the month in negative-offset timezones).
  const [year, month] = monthStart.split('-').map(Number); // month is 1-12
  const nextMonthStart = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  // Embedded-resource filters don't reliably filter parent rows in PostgREST, so
  // resolve the family's students first (same pattern as useParentPaymentSummaryWithPrepaid).
  const { data: students } = await supabase
    .from('students')
    .select('id, name')
    .eq('parent_id', parentId);

  if (!students || students.length === 0) return EMPTY;
  const nameById = new Map(students.map((s) => [s.id, s.name as string]));

  const { data: lessons } = await supabase
    .from('scheduled_lessons')
    .select('id, scheduled_at, subject, student_id')
    .in('student_id', students.map((s) => s.id))
    .eq('status', 'completed')
    .gte('scheduled_at', monthStart)
    .lt('scheduled_at', `${nextMonthStart}T00:00:00.000Z`);

  if (!lessons || lessons.length === 0) return EMPTY;

  const matched = lessons
    .filter((l) => lessonCountsTowardPrepaid(l.subject, paymentSubject, prepaidSubjects))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  return {
    count: matched.length,
    lessons: matched.map((l) => ({
      id: l.id,
      scheduledAt: l.scheduled_at,
      subject: l.subject,
      studentName: nameById.get(l.student_id) || '',
    })),
  };
}
