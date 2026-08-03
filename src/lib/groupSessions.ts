/**
 * Which lesson_sessions actually price as a group.
 *
 * A session prices as a group only when it holds more than one student lesson —
 * the same rule the calendar uses to label a "Combined Session". A lone lesson
 * that merely carries a session id is a normal solo lesson: opening a
 * one-student lesson for parent enrollment creates a session, and before this
 * rule existed that alone flipped the lesson onto the (lower) group rate even
 * if nobody ever joined.
 *
 * Lessons count whatever their status. A group that shrinks to one because the
 * others cancelled still bills everyone at the group rate — the price follows
 * how the session was booked, not who showed up.
 *
 * The pure helper is separate from the query so it can be unit-tested and so
 * callers that already hold every lesson of a session can skip the round trip.
 */
import { supabase } from './supabase';

/** Session ids that appear more than once in `rows`. */
export function collectGroupSessionIds(rows: { session_id: string | null }[]): Set<string> {
  const counts = new Map<string, number>();
  rows.forEach(({ session_id }) => {
    if (!session_id) return;
    counts.set(session_id, (counts.get(session_id) ?? 0) + 1);
  });

  const groups = new Set<string>();
  counts.forEach((count, sessionId) => {
    if (count > 1) groups.add(sessionId);
  });
  return groups;
}

/**
 * Of the given session ids, the ones that hold more than one lesson.
 *
 * Counts across every lesson of each session, not just the caller's slice — an
 * invoice run sees one family at a time, and a session spans families.
 */
export async function fetchGroupSessionIds(
  sessionIds: (string | null)[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(sessionIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Set();

  const { data, error } = await supabase
    .from('scheduled_lessons')
    .select('session_id')
    .in('session_id', ids);

  if (error) throw new Error(error.message);
  return collectGroupSessionIds((data as { session_id: string | null }[]) || []);
}
