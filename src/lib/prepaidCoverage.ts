/**
 * Prepaid coverage decision (pure).
 *
 * When a prepaid-subject lesson is completed, `useCompleteLesson` increments the
 * matching month's prepaid payment `sessions_used`. If there is NO prepaid payment
 * for the month — or the package is already over its purchased session count — the
 * completion has nothing to draw from and the session goes uncharged.
 *
 * This function decides, given the prepaid payment row the completion flow looked
 * up (after any increment), whether the lesson was actually covered by a balance.
 * Kept pure so it can be unit-tested and shared by the calendar completion handlers.
 */

export interface PrepaidRow {
  sessions_used: number | null;
  sessions_prepaid: number | null;
}

/**
 * @param row The month's prepaid payment for the lesson's (parent, subject),
 *            or null when none exists. `sessions_used` is read AFTER the
 *            completion flow's increment.
 * @returns 'covered' when the lesson drew from a real balance, 'uncovered' when
 *          there was no package or the package is exhausted/over-drawn.
 */
export function prepaidCoverage(row: PrepaidRow | null): 'covered' | 'uncovered' {
  if (!row) return 'uncovered';
  // A legacy/unlimited package has no purchased-session cap — always covered.
  if (row.sessions_prepaid == null) return 'covered';
  // Post-increment: using the last available slot (used === prepaid) is covered;
  // going past the purchased count (used > prepaid) is not.
  return (row.sessions_used ?? 0) <= row.sessions_prepaid ? 'covered' : 'uncovered';
}
