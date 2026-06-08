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

Deno.test('combined session uses same amount as single (flag ignored)', () => {
  const settings = { subject_rates: { math: { rate: 60, base_duration: 60 } } };
  assertEquals(
    calculateLessonAmount(settings, 'math', 60, true, null),
    calculateLessonAmount(settings, 'math', 60, false, null),
  );
});
