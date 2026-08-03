// Which lesson_sessions actually price as a group. Port of
// src/lib/groupSessions.ts — keep in sync (groupSessions.test.ts pins it).
//
// A session prices as a group only when it holds more than one student lesson,
// matching the "Combined Session" label in the app. A lone lesson that merely
// carries a session id (e.g. one opened for parent enrollment that nobody
// joined) is priced as a normal solo lesson.
//
// Lessons count whatever their status: a group that shrinks to one because the
// others cancelled still bills at the group rate.

/** Session ids that appear more than once in `rows`. */
export function collectGroupSessionIds(rows: { session_id: string | null }[]): Set<string> {
  const counts = new Map<string, number>();
  for (const { session_id } of rows) {
    if (!session_id) continue;
    counts.set(session_id, (counts.get(session_id) ?? 0) + 1);
  }

  const groups = new Set<string>();
  for (const [sessionId, count] of counts) {
    if (count > 1) groups.add(sessionId);
  }
  return groups;
}

/**
 * Of the given session ids, the ones that hold more than one lesson. Counts
 * across every lesson of each session, not just the caller's slice — a session
 * spans families, and an invoice run sees one family at a time.
 */
export async function fetchGroupSessionIds(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sessionIds: (string | null)[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(sessionIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Set();

  const { data } = await supabase
    .from('scheduled_lessons')
    .select('session_id')
    .in('session_id', ids);

  return collectGroupSessionIds((data ?? []) as { session_id: string | null }[]);
}
