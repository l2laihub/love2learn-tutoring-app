import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { collectGroupSessionIds } from './groupSessions.ts';

Deno.test('a session with two lessons is a group', () => {
  const groups = collectGroupSessionIds([
    { session_id: 's1' },
    { session_id: 's1' },
  ]);
  assertEquals(groups.has('s1'), true);
});

Deno.test('a session with one lesson is not a group', () => {
  // A solo lesson opened for parent enrollment that nobody joined: it carries a
  // session id but must stay on the individual rate.
  const groups = collectGroupSessionIds([{ session_id: 's1' }]);
  assertEquals(groups.has('s1'), false);
  assertEquals(groups.size, 0);
});

Deno.test('lessons without a session are ignored', () => {
  const groups = collectGroupSessionIds([
    { session_id: null },
    { session_id: null },
  ]);
  assertEquals(groups.size, 0);
});

Deno.test('cancelled students still count toward the group', () => {
  // Status is deliberately not consulted: a group that shrinks to one because
  // the others cancelled keeps group pricing for whoever is left.
  const groups = collectGroupSessionIds([
    { session_id: 's1', status: 'scheduled' },
    { session_id: 's1', status: 'cancelled' },
    { session_id: 's1', status: 'cancelled' },
  ]);
  assertEquals(groups.has('s1'), true);
});

Deno.test('sessions are classified independently', () => {
  const groups = collectGroupSessionIds([
    { session_id: 'group' },
    { session_id: 'group' },
    { session_id: 'solo' },
    { session_id: null },
  ]);
  assertEquals(Array.from(groups), ['group']);
});

Deno.test('no lessons at all', () => {
  assertEquals(collectGroupSessionIds([]).size, 0);
});
