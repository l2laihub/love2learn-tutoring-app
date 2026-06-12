import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filterSeriesLessonIds } from './lessonSeries.ts';

const TZ = 'America/Los_Angeles';

// Weekly Tuesday 15:00 PT series (2026-06-16 is a Tuesday; 15:00 PDT = 22:00 UTC)
const series = [
  { id: 'past-2', scheduled_at: '2026-06-02T22:00:00.000Z' },
  { id: 'past-1', scheduled_at: '2026-06-09T22:00:00.000Z' },
  { id: 'anchor', scheduled_at: '2026-06-16T22:00:00.000Z' },
  { id: 'future-1', scheduled_at: '2026-06-23T22:00:00.000Z' },
  { id: 'future-2', scheduled_at: '2026-06-30T22:00:00.000Z' },
];

Deno.test('excludes past occurrences (regression: series edit updated past lessons)', () => {
  const ids = filterSeriesLessonIds(series, { scheduled_at: '2026-06-16T22:00:00.000Z' }, TZ);
  assertEquals(ids, ['anchor', 'future-1', 'future-2']);
});

Deno.test('includes the anchor lesson itself', () => {
  const ids = filterSeriesLessonIds(series, { scheduled_at: '2026-06-30T22:00:00.000Z' }, TZ);
  assertEquals(ids, ['future-2']);
});

Deno.test('excludes lessons at a different time of day', () => {
  const candidates = [
    ...series,
    // Same Tuesday but 16:00 PT — a different series
    { id: 'other-time', scheduled_at: '2026-06-23T23:00:00.000Z' },
  ];
  const ids = filterSeriesLessonIds(candidates, { scheduled_at: '2026-06-16T22:00:00.000Z' }, TZ);
  assertEquals(ids.includes('other-time'), false);
});

Deno.test('excludes lessons on a different day of week', () => {
  const candidates = [
    ...series,
    // Wednesday 15:00 PT
    { id: 'other-day', scheduled_at: '2026-06-24T22:00:00.000Z' },
  ];
  const ids = filterSeriesLessonIds(candidates, { scheduled_at: '2026-06-16T22:00:00.000Z' }, TZ);
  assertEquals(ids.includes('other-day'), false);
});

Deno.test('matches wall-clock time across a DST transition', () => {
  // Weekly Tuesday 15:00 PT: 2026-10-27 is PDT (22:00 UTC), 2026-11-10 is PST (23:00 UTC)
  const dstSeries = [
    { id: 'pdt', scheduled_at: '2026-10-27T22:00:00.000Z' },
    { id: 'pst', scheduled_at: '2026-11-10T23:00:00.000Z' },
  ];
  const ids = filterSeriesLessonIds(dstSeries, { scheduled_at: '2026-10-27T22:00:00.000Z' }, TZ);
  assertEquals(ids, ['pdt', 'pst']);
});
