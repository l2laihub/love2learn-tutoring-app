import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  calculateLessonAmount,
  weekWindowForSaturday,
  buildRecapMessage,
  localDateStartToUtcISO,
} from './recap.ts';

const settings = {
  default_rate: 45,
  default_base_duration: 60,
  subject_rates: {
    piano: { rate: 30, base_duration: 30, duration_prices: { '45': 50 } },
    math: { rate: 60, base_duration: 60 },
  },
};

Deno.test('override wins over rates', () => {
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, 99), 99);
});

Deno.test('explicit duration tier price', () => {
  // piano has a 45-min tier priced at $50
  assertEquals(calculateLessonAmount(settings, 'piano', 45, false, null), 50);
});

Deno.test('base-duration scaling', () => {
  // piano 30/30min rate, 60min => 2 * 30 = 60
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
  // math 60/60min, 30min => 0.5 * 60 = 30
  assertEquals(calculateLessonAmount(settings, 'math', 30, false, null), 30);
});

Deno.test('falls back to default rate for unknown subject', () => {
  // english not in subject_rates => default 45/60min, 60min => 45
  assertEquals(calculateLessonAmount(settings, 'english', 60, false, null), 45);
});

Deno.test('weekWindowForSaturday returns Sun..Fri for the ending week', () => {
  // Saturday 2026-06-06 → window Sun 2026-05-31 .. Fri 2026-06-05
  const w = weekWindowForSaturday(new Date('2026-06-06T08:00:00'));
  assertEquals(w.weekStart, '2026-05-31');
  assertEquals(w.weekEndExclusive, '2026-06-06'); // [Sun 00:00, Sat 00:00)
});

Deno.test('buildRecapMessage shows quiet-week note', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'May 31–Jun 5',
    lessons: [],
    received: 0,
    outstanding: 0,
    expected: 0,
  });
  assertEquals(msg.includes('No classes scheduled'), true);
});

Deno.test('buildRecapMessage renders populated body', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'May 31–Jun 5',
    lessons: [
      { date: 'Mon Jun 1', studentName: 'Ava', subjectLabel: '🎹 Piano', status: 'completed' },
      { date: 'Wed Jun 3', studentName: 'Ben', subjectLabel: '📐 Math', status: 'cancelled' },
    ],
    received: 120,
    outstanding: 45.5,
    expected: 200,
  });
  assertEquals(msg.includes('Classes (2)'), true);
  assertEquals(msg.includes('✅'), true);
  assertEquals(msg.includes('❌'), true);
  assertEquals(msg.includes('$120.00'), true);
  assertEquals(msg.includes('Expected from this week'), true);
});

Deno.test('recap shows auto-marked count when present', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [{ date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed', paid: true }],
    received: 0, outstanding: 0, expected: 45, autoMarked: 1,
  });
  if (!msg.includes('auto-marked')) throw new Error('expected auto-marked line');
  if (!msg.includes('Amy · 📐 Math 💵')) throw new Error('expected paid indicator on class line');
});

Deno.test('recap omits auto-marked line when zero', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [{ date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed', paid: false }],
    received: 0, outstanding: 0, expected: 45, autoMarked: 0,
  });
  if (msg.includes('auto-marked')) throw new Error('did not expect auto-marked line');
});

Deno.test('recap shows unpaid indicator for invoiced-but-unpaid completed lessons', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [{ date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed', paid: false }],
    received: 0, outstanding: 45, expected: 45,
  });
  if (!msg.includes('Amy · 📐 Math ⚠️')) throw new Error('expected unpaid indicator on class line');
  if (msg.includes('Amy · 📐 Math 💵')) throw new Error('did not expect paid indicator');
});

Deno.test('recap shows no paid/unpaid marker when paid status is unknown', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 1–Jun 6',
    lessons: [
      // paid undefined → prepaid-covered or not yet invoiced
      { date: 'Mon Jun 1', studentName: 'Amy', subjectLabel: '📐 Math', status: 'completed' },
      { date: 'Tue Jun 2', studentName: 'Ben', subjectLabel: '🎹 Piano', status: 'scheduled', paid: false },
    ],
    received: 0, outstanding: 0, expected: 90,
  });
  if (!msg.includes('✅ Amy · 📐 Math\n')) throw new Error('expected bare class line for unknown paid status');
  if (!msg.includes('• Ben · 🎹 Piano\n')) throw new Error('expected no unpaid marker on non-completed lessons');
});

Deno.test('recap groups lessons under one bold header per day', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'Jun 7–Jun 12',
    lessons: [
      { date: 'Tue, Jun 9', studentName: 'Audrey', subjectLabel: '🎹 Piano', status: 'completed', paid: false },
      { date: 'Tue, Jun 9', studentName: 'Chloe', subjectLabel: '🎹 Piano', status: 'completed', paid: true },
      { date: 'Wed, Jun 10', studentName: 'An', subjectLabel: '🗣️ Speech', status: 'scheduled' },
    ],
    received: 0, outstanding: 0, expected: 150,
  });
  // Each day appears exactly once, as a bold header; lesson lines omit the date.
  assertEquals(msg.split('Tue, Jun 9').length - 1, 1);
  assertEquals(msg.includes('<b>Tue, Jun 9</b>'), true);
  assertEquals(msg.includes('<b>Wed, Jun 10</b>'), true);
  assertEquals(msg.includes('✅ Audrey · 🎹 Piano ⚠️'), true);
  assertEquals(msg.includes('✅ Chloe · 🎹 Piano 💵'), true);
  assertEquals(msg.includes('• An · 🗣️ Speech'), true);
});

Deno.test('localDateStartToUtcISO: America/Los_Angeles (PDT, UTC-7)', () => {
  assertEquals(localDateStartToUtcISO('2026-05-31', 'America/Los_Angeles'), '2026-05-31T07:00:00.000Z');
});
Deno.test('localDateStartToUtcISO: Asia/Singapore (UTC+8)', () => {
  assertEquals(localDateStartToUtcISO('2026-05-31', 'Asia/Singapore'), '2026-05-30T16:00:00.000Z');
});
Deno.test('localDateStartToUtcISO: UTC', () => {
  assertEquals(localDateStartToUtcISO('2026-05-31', 'UTC'), '2026-05-31T00:00:00.000Z');
});

Deno.test('buildRecapMessage escapes HTML in user text', () => {
  const msg = buildRecapMessage({
    rangeLabel: 'May 31–Jun 5',
    lessons: [
      { date: 'Mon Jun 1', studentName: 'A & B <x>', subjectLabel: '🎹 Piano', status: 'completed' },
    ],
    received: 0,
    outstanding: 0,
    expected: 0,
  });
  assertEquals(msg.includes('A &amp; B &lt;x&gt;'), true);
  assertEquals(msg.includes('<x>'), false);
});

Deno.test('recap: combined session uses group rate when set', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null), 30);
});
