/**
 * Pure logic for splitting a combined session's duration across its lessons.
 * Shared by session creation and single-lesson → session conversion.
 *
 * Scenarios:
 * - B  (multi-subject student): each lesson uses its subject's base duration,
 *      session total = sum of lesson durations
 * - A1 (group lesson — multiple students, same subject): every student attends
 *      the full session, so each lesson gets the full session duration
 * - A2 (sequential lessons — different subjects): session time is divided
 *      equally among the lessons
 *
 * No React/RN/Supabase imports so it can be unit-tested with Deno
 * (see sessionPlan.test.ts), same pattern as openSlots.ts.
 */

export interface SessionLessonPlan<T> {
  /** Total session duration in minutes (lesson_sessions.duration_min) */
  totalDuration: number;
  /** One entry per lesson with its computed duration */
  lessons: Array<T & { duration_min: number }>;
}

export function buildSessionLessonPlan<T extends { student_id: string; subject: string }>(
  selections: T[],
  sessionDuration: number,
  getBaseDuration: (subject: T['subject']) => number
): SessionLessonPlan<T> {
  const studentSubjectCounts = new Map<string, number>();
  for (const selection of selections) {
    studentSubjectCounts.set(selection.student_id, (studentSubjectCounts.get(selection.student_id) || 0) + 1);
  }
  const hasStudentWithMultipleSubjects = Array.from(studentSubjectCounts.values()).some(count => count > 1);

  const uniqueSubjects = new Set(selections.map(s => s.subject));
  const isGroupLesson = uniqueSubjects.size === 1 && selections.length > 1;

  if (hasStudentWithMultipleSubjects) {
    // Scenario B: use each subject's base duration from tutor settings
    const lessons = selections.map(selection => ({
      ...selection,
      duration_min: getBaseDuration(selection.subject),
    }));
    return {
      totalDuration: lessons.reduce((sum, lesson) => sum + lesson.duration_min, 0),
      lessons,
    };
  }

  if (isGroupLesson) {
    // Scenario A1: everyone shares the full session
    return {
      totalDuration: sessionDuration,
      lessons: selections.map(selection => ({ ...selection, duration_min: sessionDuration })),
    };
  }

  // Scenario A2: divide session time equally among lessons
  const perLessonDuration = Math.floor(sessionDuration / selections.length);
  return {
    totalDuration: sessionDuration,
    lessons: selections.map(selection => ({ ...selection, duration_min: perLessonDuration })),
  };
}
