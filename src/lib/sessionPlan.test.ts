import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildSessionLessonPlan } from './sessionPlan.ts';

const baseDurations: Record<string, number> = { piano: 30, reading: 60, math: 60, speech: 45 };
const getBase = (subject: string) => baseDurations[subject] ?? 30;

Deno.test('A1 group lesson: same subject, every student gets the full session', () => {
  const plan = buildSessionLessonPlan(
    [
      { student_id: 's1', subject: 'math' },
      { student_id: 's2', subject: 'math' },
    ],
    60,
    getBase
  );
  assertEquals(plan.totalDuration, 60);
  assertEquals(plan.lessons.map(l => l.duration_min), [60, 60]);
});

Deno.test('A2 sequential lessons: different subjects split the session equally', () => {
  const plan = buildSessionLessonPlan(
    [
      { student_id: 's1', subject: 'piano' },
      { student_id: 's2', subject: 'speech' },
    ],
    60,
    getBase
  );
  assertEquals(plan.totalDuration, 60);
  assertEquals(plan.lessons.map(l => l.duration_min), [30, 30]);
});

Deno.test('B multi-subject student: each subject uses its base duration, total is the sum', () => {
  const plan = buildSessionLessonPlan(
    [
      { student_id: 's1', subject: 'piano' },
      { student_id: 's1', subject: 'reading' },
    ],
    60,
    getBase
  );
  assertEquals(plan.totalDuration, 90);
  assertEquals(plan.lessons.map(l => l.duration_min), [30, 60]);
});

Deno.test('single lesson keeps the full session duration', () => {
  const plan = buildSessionLessonPlan([{ student_id: 's1', subject: 'piano' }], 45, getBase);
  assertEquals(plan.totalDuration, 45);
  assertEquals(plan.lessons.map(l => l.duration_min), [45]);
});

Deno.test('preserves extra selection fields on each lesson', () => {
  const plan = buildSessionLessonPlan(
    [
      { student_id: 's1', subject: 'math', note: 'a' },
      { student_id: 's2', subject: 'math', note: 'b' },
    ],
    60,
    getBase
  );
  assertEquals(plan.lessons.map(l => l.note), ['a', 'b']);
});
