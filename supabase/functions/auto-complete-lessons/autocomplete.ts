// Pure, dependency-free helpers for the auto-complete job. Unit-tested in
// autocomplete.test.ts so the time/billing logic is verifiable without a DB.

export interface CandidateLesson {
  id: string;
  subject: string;
  scheduled_at: string;
  duration_min: number;
  session_id: string | null;
  override_amount: number | null;
  student?: {
    id: string;
    name?: string;
    parent_id: string;
    parent?: {
      id: string;
      billing_mode: string;
      prepaid_subjects: string[] | null;
    } | null;
  } | null;
}

// Keep only lessons whose end time (scheduled_at + duration) is at or before now,
// AND that started within the look-back window (started no more than maxAgeDays
// ago). The window bounds how far back the job will sweep stale scheduled lessons.
export function dueLessons(
  rows: CandidateLesson[],
  nowMs: number,
  maxAgeDays: number,
): CandidateLesson[] {
  const oldestMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;
  return (rows ?? []).filter((l) => {
    const start = new Date(l.scheduled_at).getTime();
    const end = start + (Number(l.duration_min) || 0) * 60_000;
    return end <= nowMs && start >= oldestMs;
  });
}

// A subject is prepaid if the family is fully prepaid (prepaid mode + no subject
// list) or the subject is explicitly listed. Mirrors calendar.tsx:690-691.
export function isSubjectPrepaid(
  billingMode: string | null | undefined,
  prepaidSubjects: string[] | null | undefined,
  subject: string,
): boolean {
  const lower = (prepaidSubjects ?? []).map((s) => s.toLowerCase());
  const fullyPrepaid = billingMode === 'prepaid' && lower.length === 0;
  return fullyPrepaid || lower.includes((subject ?? '').toLowerCase());
}

// Notification text for prepaid lessons the job auto-completed but couldn't draw
// against (no active package, or the package was already exhausted). Mirrors the
// calendar's Alert copy (calendar.tsx:562-567) so the cron and the UI tell the
// tutor the same thing. Pure so it can be unit-tested without a DB.
export function buildUncoveredPrepaidMessage(
  items: { studentName: string; subject: string }[],
): { title: string; message: string } {
  const lines = items.map((i) => `• ${i.studentName} (${i.subject})`).join('\n');
  return {
    title: items.length === 1 ? 'Prepaid lesson not charged' : 'Prepaid lessons not charged',
    message:
      `These auto-completed prepaid lesson(s) had no active prepaid package for the month, ` +
      `so they were not charged:\n\n${lines}\n\n` +
      `Add a prepaid package for the family, or switch them to invoicing, to bill these sessions.`,
  };
}
