import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { lessonCountsTowardPrepaid, isSubjectOnPrepaid } from './prepaidCoverage.ts';

// lessonCountsTowardPrepaid — membership rule behind the derived sessions_used.

Deno.test('per-subject package: same subject (case-insensitive) -> counts', () => {
  assertEquals(lessonCountsTowardPrepaid('Piano', 'piano', ['piano']), true);
});

Deno.test('per-subject package: different subject -> does not count', () => {
  assertEquals(lessonCountsTowardPrepaid('Math', 'piano', ['piano']), false);
});

Deno.test('legacy all-subjects package (no per-subject config) -> counts any subject', () => {
  assertEquals(lessonCountsTowardPrepaid('Math', null, []), true);
});

Deno.test('hybrid mode: legacy row does NOT swallow an unlisted subject', () => {
  // Family has a per-subject prepaid (piano); a Math lesson must not draw from a
  // legacy/all-subjects row — Math should be invoiced instead.
  assertEquals(lessonCountsTowardPrepaid('Math', null, ['piano']), false);
});

// isSubjectOnPrepaid — config-level flag the calendar chip uses.

Deno.test('fully-prepaid family covers any subject', () => {
  assertEquals(isSubjectOnPrepaid('prepaid', [], 'Math'), true);
});

Deno.test('hybrid family: listed subject is prepaid, unlisted is not', () => {
  assertEquals(isSubjectOnPrepaid('prepaid', ['piano'], 'Piano'), true);
  assertEquals(isSubjectOnPrepaid('prepaid', ['piano'], 'Math'), false);
});

Deno.test('invoice family with no prepaid subjects is never prepaid', () => {
  assertEquals(isSubjectOnPrepaid('invoice', [], 'Math'), false);
});
