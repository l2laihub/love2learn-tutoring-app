import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { calculateLessonAmount } from './lessonAmount.ts';

Deno.test('default rate when no settings', () => {
  assertEquals(calculateLessonAmount(null, 'math', 60, false, null), 45);
});

Deno.test('override wins', () => {
  assertEquals(calculateLessonAmount(null, 'math', 30, false, 12.5), 12.5);
});

Deno.test('subject rate, pro-rated by duration', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 30, false, null), 30);
});

Deno.test('explicit duration tier price', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60, duration_prices: { '45': 50 } } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 45, false, null), 50);
});

Deno.test('combined session falls back to individual rate when no group rate set', () => {
  const settings = { subject_rates: { math: { rate: 60, base_duration: 60 } } };
  assertEquals(
    calculateLessonAmount(settings, 'math', 60, true, null),
    calculateLessonAmount(settings, 'math', 60, false, null),
  );
});

Deno.test('combined session uses group rate when set (linear)', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null), 30);
  // non-combined still uses the individual rate
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
});

Deno.test('combined session uses group duration tier when set', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60, duration_prices: { '45': 25 } } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 45, true, null), 25);
});

Deno.test('group rate ignored for non-combined lessons', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null), 60);
});

Deno.test('override wins even for combined session with group rate', () => {
  const settings = { group_subject_rates: { piano: { rate: 30, base_duration: 60 } } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, 12.5), 12.5);
});

Deno.test('student rate wins over subject rate (solo)', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 40);
});

Deno.test('student rate wins over group rate (combined)', () => {
  const settings = {
    subject_rates: { piano: { rate: 60, base_duration: 60 } },
    group_subject_rates: { piano: { rate: 30, base_duration: 60 } },
  };
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, true, null, studentRates), 40);
});

Deno.test('student rate duration tier applies', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60, duration_prices: { '45': 35 } } };
  assertEquals(calculateLessonAmount(null, 'piano', 45, false, null, studentRates), 35);
});

Deno.test('student rate pro-rated by duration', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(null, 'piano', 30, false, null, studentRates), 20);
});

Deno.test('inactive student rate falls through to subject rate', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { piano: { rate: 0, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 60);
});

Deno.test('no student rate for subject falls through', () => {
  const settings = { subject_rates: { piano: { rate: 60, base_duration: 60 } } };
  const studentRates = { math: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(settings, 'piano', 60, false, null, studentRates), 60);
});

Deno.test('override_amount beats an active student rate', () => {
  const studentRates = { piano: { rate: 40, base_duration: 60 } };
  assertEquals(calculateLessonAmount(null, 'piano', 60, false, 12.5, studentRates), 12.5);
});
