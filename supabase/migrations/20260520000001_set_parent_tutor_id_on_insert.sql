-- Migration: Auto-set tutor_id when a tutor creates a parent
--
-- Problem: The "Add Parent" flow inserts into `parents` via
-- `insert(input).select()`. The input has no tutor_id, so the row is created
-- with tutor_id = NULL. Migration 20260202000002 removed the `tutor_id IS NULL`
-- fallback from the parents SELECT policy, so the RETURNING clause (from
-- `.select()`) can no longer read the just-inserted row. Postgres then raises
-- "new row violates row-level security policy for table parents".
--
-- Every other tenant-scoped table (students, scheduled_lessons, payments,
-- assignments, parent_groups) got a BEFORE INSERT trigger in migration
-- 20260201000005 to auto-set tutor_id, but the parents table was missed.
-- This adds the matching trigger.
--
-- Safety for the other parent-creation paths:
--   - Tutor self-registration inserts role = 'tutor' -> guard skips it.
--   - Invited-parent rows are created with tutor_id already set -> guard skips.
--   - Self-registering parents (handle_new_user) have no tutor context, so
--     get_current_tutor_id() returns NULL and tutor_id stays NULL (unchanged).

CREATE OR REPLACE FUNCTION set_parent_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fill tutor_id for parent rows created without one. Tutor rows keep
  -- tutor_id = NULL (they ARE the tutor).
  IF NEW.role = 'parent' AND NEW.tutor_id IS NULL THEN
    NEW.tutor_id := get_current_tutor_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_parent_tutor_id ON parents;
CREATE TRIGGER trigger_set_parent_tutor_id
  BEFORE INSERT ON parents
  FOR EACH ROW
  EXECUTE FUNCTION set_parent_tutor_id();

COMMENT ON FUNCTION set_parent_tutor_id() IS 'Sets parents.tutor_id to the current tutor when a tutor creates a parent without specifying one. Skips tutor rows and rows that already have tutor_id.';
