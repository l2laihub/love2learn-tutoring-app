-- Migration: Allow tutors to delete parents in their business
--
-- Problem: The parents table has SELECT/INSERT/UPDATE policies but no DELETE
-- policy. With RLS enabled, a DELETE with no matching policy affects zero rows
-- and returns success with no error, so the "Delete Parent" action silently
-- does nothing.
--
-- Fix: Add a DELETE policy mirroring the students delete policy, scoped to the
-- tutor's own business (parents linked to them via tutor_id). Cascading deletes
-- of dependent rows are handled by the foreign-key constraints.

DROP POLICY IF EXISTS "Users can delete parent profiles" ON parents;

CREATE POLICY "Users can delete parent profiles"
ON parents
FOR DELETE
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

COMMENT ON POLICY "Users can delete parent profiles" ON parents IS 'Tutors can delete parents linked to their business.';
