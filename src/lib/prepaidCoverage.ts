/**
 * Pure decision helpers for prepaid lessons.
 *
 * `sessions_used` is derived by counting completed lessons that match a package's scope
 * (see lib/prepaidSessions), so these rules — which lessons count, and whether a subject
 * is prepaid at all — are the shared, unit-tested membership logic behind that count and
 * the UI that flags prepaid lessons.
 */

/**
 * Does a completed lesson count against a given prepaid payment row? (pure)
 *
 * `sessions_used` is derived by counting completed lessons that match the row's
 * scope, so this is the single rule shared by the count helper and any caller
 * that needs to decide membership. Mirrors the lookup `useCompleteLesson` used
 * to do inline.
 *
 * @param lessonSubject   The lesson's subject (raw casing).
 * @param paymentSubject  The prepaid row's `subject`: a specific subject
 *                        (lowercased) for a per-subject package, or null for a
 *                        legacy all-subjects package.
 * @param prepaidSubjects The family's per-subject prepaid config (lowercased).
 *                        A legacy/all-subjects row only applies when this is
 *                        empty — otherwise the family is in hybrid mode and
 *                        unlisted subjects are invoiced, not drawn from legacy.
 */
export function lessonCountsTowardPrepaid(
  lessonSubject: string,
  paymentSubject: string | null,
  prepaidSubjects: string[],
): boolean {
  if (paymentSubject != null) {
    return lessonSubject.toLowerCase() === paymentSubject.toLowerCase();
  }
  return prepaidSubjects.length === 0;
}

/**
 * Is a lesson's subject billed via prepaid for its family? (pure, config-level)
 *
 * Decided from the family's billing config alone — no payment row needed — so the UI
 * can flag prepaid lessons without a query. A fully-prepaid family (billing_mode
 * 'prepaid', no per-subject overrides) covers every subject; otherwise only the
 * subjects listed in `prepaidSubjects` are prepaid (hybrid mode).
 */
export function isSubjectOnPrepaid(
  billingMode: string | null | undefined,
  prepaidSubjects: string[],
  lessonSubject: string,
): boolean {
  const subs = prepaidSubjects.map((s) => s.toLowerCase());
  const fullyPrepaid = billingMode === 'prepaid' && subs.length === 0;
  return fullyPrepaid || subs.includes(lessonSubject.toLowerCase());
}
