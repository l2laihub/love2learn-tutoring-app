/**
 * Human-readable message for a failed parent insert/update.
 *
 * parents.email carries a global UNIQUE constraint (parents_email_unique from
 * the initial schema), but RLS hides rows belonging to another tutor -- or to
 * nobody at all (tutor_id IS NULL, e.g. a parent who signed up on their own,
 * since 20260202000002 dropped the NULL fallback from the SELECT policy). A
 * tutor can therefore collide with a row they cannot see, so that case needs
 * wording that explains the invisible conflict instead of the raw constraint.
 */
export function parentSaveErrorMessage(error: unknown): string {
  const err = (error ?? {}) as { code?: string; message?: string };
  const message = typeof err.message === 'string' ? err.message : '';

  if (err.code === '23505' || message.includes('parents_email_unique')) {
    return 'A parent with that email address already exists. They may be registered with another tutor, or have signed up on their own — use a different email, or ask them to sign in with that address.';
  }

  return message || 'Something went wrong. Please try again.';
}
