-- Migration: Add legacy fallback to shared_resources RLS
-- Version: 20260201000010
-- Description: Adds tutor_id IS NULL fallback to shared_resources for consistency
--              with other tables during migration period
--
-- Problem: Unlike other tables (students, payments, etc.), the shared_resources
-- RLS policy requires an exact tutor_id match with no NULL fallback. This makes
-- any legacy resources with NULL tutor_id invisible to tutors.
--
-- Solution: Add the same legacy fallback pattern used by other tables.

-- ============================================================================
-- UPDATE SHARED_RESOURCES POLICY
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Tutors can manage all shared resources" ON shared_resources;

-- Recreate with legacy fallback
CREATE POLICY "Tutors can manage all shared resources"
ON shared_resources
FOR ALL
TO authenticated
USING (
    is_tutor() AND (
        tutor_id = get_current_tutor_id()
        OR tutor_id IS NULL  -- Legacy fallback for migration period
    )
)
WITH CHECK (
    -- New records must have correct tutor_id (no NULL allowed)
    is_tutor() AND tutor_id = get_current_tutor_id()
);

COMMENT ON POLICY "Tutors can manage all shared resources" ON shared_resources
IS 'Tutors can manage resources in their business. Legacy fallback allows viewing NULL tutor_id resources during migration.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'shared_resources RLS policy updated with legacy fallback';
END $$;
