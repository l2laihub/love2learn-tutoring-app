import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { dueLessons, isSubjectPrepaid } from './autocomplete.ts';

const NOW = Date.UTC(2026, 5, 7, 18, 0, 0); // 2026-06-07T18:00:00Z
const MAX_AGE = 7;

Deno.test('dueLessons keeps lessons whose end time has passed', () => {
  const rows = [
    { id: 'a', scheduled_at: '2026-06-07T16:00:00Z', duration_min: 60 }, // ends 17:00 -> due
    { id: 'b', scheduled_at: '2026-06-07T17:30:00Z', duration_min: 60 }, // ends 18:30 -> not due
    { id: 'c', scheduled_at: '2026-06-07T17:00:00Z', duration_min: 60 }, // ends 18:00 == now -> due
  ];
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['a', 'c']);
});

Deno.test('dueLessons handles empty/zero duration', () => {
  assertEquals(dueLessons([] as any, NOW, MAX_AGE), []);
  const rows = [{ id: 'z', scheduled_at: '2026-06-07T18:00:00Z', duration_min: 0 }]; // ends now -> due
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['z']);
});

Deno.test('dueLessons excludes lessons older than the look-back window', () => {
  const rows = [
    { id: 'old', scheduled_at: '2026-05-20T16:00:00Z', duration_min: 60 }, // ~18 days ago -> excluded
    { id: 'edge', scheduled_at: '2026-05-31T18:00:00Z', duration_min: 60 }, // exactly 7 days before now -> kept
    { id: 'recent', scheduled_at: '2026-06-06T16:00:00Z', duration_min: 60 }, // 1 day ago -> kept
  ];
  assertEquals(dueLessons(rows as any, NOW, MAX_AGE).map((l) => l.id), ['edge', 'recent']);
});

Deno.test('isSubjectPrepaid: fully-prepaid family (no subject list) -> any subject prepaid', () => {
  assertEquals(isSubjectPrepaid('prepaid', [], 'math'), true);
});

Deno.test('isSubjectPrepaid: hybrid -> only listed subjects prepaid', () => {
  assertEquals(isSubjectPrepaid('prepaid', ['piano'], 'piano'), true);
  assertEquals(isSubjectPrepaid('prepaid', ['piano'], 'math'), false);
});

Deno.test('isSubjectPrepaid: invoice family -> never prepaid', () => {
  assertEquals(isSubjectPrepaid('invoice', [], 'math'), false);
  assertEquals(isSubjectPrepaid('invoice', ['piano'], 'piano'), true); // listed subject still prepaid
});
