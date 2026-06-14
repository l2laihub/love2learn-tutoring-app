/**
 * Prepaid coverage decision (pure) — edge-function copy.
 *
 * Mirrors src/lib/prepaidCoverage.ts (the calendar-completion rule) so the
 * auto-complete cron applies the SAME "was this prepaid lesson actually charged?"
 * logic. Kept as a separate _shared copy (like _shared/lessonAmount.ts) because
 * the app bundle and the Deno edge runtime don't share a module tree.
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
