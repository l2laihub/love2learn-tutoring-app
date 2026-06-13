import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { prepaidCoverage } from './prepaidCoverage.ts';

Deno.test('no prepaid payment row at all -> uncovered (the reported bug)', () => {
  assertEquals(prepaidCoverage(null), 'uncovered');
});

Deno.test('package with remaining sessions -> covered', () => {
  assertEquals(prepaidCoverage({ sessions_used: 3, sessions_prepaid: 4 }), 'covered');
});

Deno.test('using the last available slot (used === prepaid) -> covered', () => {
  assertEquals(prepaidCoverage({ sessions_used: 4, sessions_prepaid: 4 }), 'covered');
});

Deno.test('over the purchased count (used > prepaid) -> uncovered', () => {
  assertEquals(prepaidCoverage({ sessions_used: 5, sessions_prepaid: 4 }), 'uncovered');
});

Deno.test('legacy/unlimited package (sessions_prepaid null) -> covered', () => {
  assertEquals(prepaidCoverage({ sessions_used: 10, sessions_prepaid: null }), 'covered');
});

Deno.test('row present but sessions_used null -> treated as 0 used -> covered', () => {
  assertEquals(prepaidCoverage({ sessions_used: null, sessions_prepaid: 4 }), 'covered');
});
