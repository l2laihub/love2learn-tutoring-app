import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateRecurringDates } from './recurrence.ts';

const TZ = 'America/Los_Angeles';

// Anchor reference: 2026-06-13 is a Saturday, so 2026-06-01 is a Monday.
// June 2026 Mondays:  Jun 1, 8, 15, 22, 29   (five Mondays)
// June 2026 Tuesdays: Jun 2, 9, 16, 23, 30
// 15:00 PDT (summer) = 22:00 UTC; 15:00 PST (winter) = 23:00 UTC.
const iso = (d: Date) => d.toISOString();

Deno.test('none returns just the start date', () => {
  const start = new Date('2026-06-08T22:00:00.000Z');
  const end = new Date('2026-12-31T22:00:00.000Z');
  assertEquals(generateRecurringDates(start, 'none', end, TZ).map(iso), [
    '2026-06-08T22:00:00.000Z',
  ]);
});

Deno.test('weekly steps 7 days and includes the anchor', () => {
  const start = new Date('2026-06-08T22:00:00.000Z'); // Mon 15:00 PT
  const end = new Date('2026-06-29T22:00:00.000Z');
  assertEquals(generateRecurringDates(start, 'weekly', end, TZ).map(iso), [
    '2026-06-08T22:00:00.000Z',
    '2026-06-15T22:00:00.000Z',
    '2026-06-22T22:00:00.000Z',
    '2026-06-29T22:00:00.000Z',
  ]);
});

Deno.test('biweekly steps 14 days', () => {
  const start = new Date('2026-06-08T22:00:00.000Z');
  const end = new Date('2026-07-20T22:00:00.000Z');
  assertEquals(generateRecurringDates(start, 'biweekly', end, TZ).map(iso), [
    '2026-06-08T22:00:00.000Z',
    '2026-06-22T22:00:00.000Z',
    '2026-07-06T22:00:00.000Z',
    '2026-07-20T22:00:00.000Z',
  ]);
});

Deno.test('monthly keeps the same day of month', () => {
  const start = new Date('2026-06-08T22:00:00.000Z');
  const end = new Date('2026-09-30T22:00:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly', end, TZ).map(iso), [
    '2026-06-08T22:00:00.000Z',
    '2026-07-08T22:00:00.000Z',
    '2026-08-08T22:00:00.000Z',
    '2026-09-08T22:00:00.000Z',
  ]);
});

Deno.test('monthly_by_week: 2nd & 4th Monday', () => {
  // Anchor = 2nd Monday (Jun 8) 15:00 PT
  const start = new Date('2026-06-08T22:00:00.000Z');
  const end = new Date('2026-08-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, [2, 4]).map(iso), [
    '2026-06-08T22:00:00.000Z', // 2nd Mon Jun
    '2026-06-22T22:00:00.000Z', // 4th Mon Jun
    '2026-07-13T22:00:00.000Z', // 2nd Mon Jul
    '2026-07-27T22:00:00.000Z', // 4th Mon Jul
    '2026-08-10T22:00:00.000Z', // 2nd Mon Aug
    '2026-08-24T22:00:00.000Z', // 4th Mon Aug
  ]);
});

Deno.test('monthly_by_week: 1st & 3rd Tuesday', () => {
  // Anchor = 1st Tuesday (Jun 2) 15:00 PT
  const start = new Date('2026-06-02T22:00:00.000Z');
  const end = new Date('2026-07-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, [1, 3]).map(iso), [
    '2026-06-02T22:00:00.000Z', // 1st Tue Jun
    '2026-06-16T22:00:00.000Z', // 3rd Tue Jun
    '2026-07-07T22:00:00.000Z', // 1st Tue Jul
    '2026-07-21T22:00:00.000Z', // 3rd Tue Jul
  ]);
});

Deno.test('monthly_by_week: occurrences before the anchor are excluded', () => {
  // Anchor = 4th Monday (Jun 22); weeks [2,4] -> 2nd Mon (Jun 8) is before anchor, dropped
  const start = new Date('2026-06-22T22:00:00.000Z');
  const end = new Date('2026-07-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, [2, 4]).map(iso), [
    '2026-06-22T22:00:00.000Z', // 4th Mon Jun (anchor)
    '2026-07-13T22:00:00.000Z', // 2nd Mon Jul
    '2026-07-27T22:00:00.000Z', // 4th Mon Jul
  ]);
});

Deno.test('monthly_by_week: Last (5) picks 5th week when present, else 4th', () => {
  // weekday Monday, Last only. June has 5 Mondays (last=Jun29), July has 4 (last=Jul27).
  const start = new Date('2026-06-01T22:00:00.000Z'); // 1st Monday; not "last", so excluded
  const end = new Date('2026-07-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, [5]).map(iso), [
    '2026-06-29T22:00:00.000Z', // last Mon Jun (the 5th)
    '2026-07-27T22:00:00.000Z', // last Mon Jul (the 4th)
  ]);
});

Deno.test('monthly_by_week: preserves 15:00 wall-clock across the PST/PDT boundary', () => {
  // 1st Monday each month, Oct 2026 -> Jan 2027. DST ends Nov 1 2026.
  // PDT (UTC-7): 15:00 = 22:00Z.  PST (UTC-8): 15:00 = 23:00Z.
  const start = new Date('2026-10-05T22:00:00.000Z'); // 1st Mon Oct (PDT)
  const end = new Date('2027-01-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, [1]).map(iso), [
    '2026-10-05T22:00:00.000Z', // PDT
    '2026-11-02T23:00:00.000Z', // PST (after fall-back)
    '2026-12-07T23:00:00.000Z', // PST
    '2027-01-04T23:00:00.000Z', // PST
  ]);
});

Deno.test('monthly_by_week: empty weeks yields no dates', () => {
  const start = new Date('2026-06-08T22:00:00.000Z');
  const end = new Date('2026-08-31T23:59:00.000Z');
  assertEquals(generateRecurringDates(start, 'monthly_by_week', end, TZ, []).map(iso), []);
});
