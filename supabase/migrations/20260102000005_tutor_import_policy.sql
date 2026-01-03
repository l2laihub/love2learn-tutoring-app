-- Migration: Allow tutors to import parents
-- Version: 20260102000005
-- Description: Adds policy for tutors to create parent records during import

-- ============================================================================
-- UPDATE PARENTS INSERT POLICY
-- ============================================================================

-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can create parent profile" ON parents;

-- Recreate with tutor support:
-- - Regular users can create their own parent profile (user_id = auth.uid())
-- - Tutors can create parent profiles for anyone (for import feature)
CREATE POLICY "Users can create parent profiles"
    ON parents FOR INSERT
    WITH CHECK (
        (auth.uid() IS NOT NULL AND user_id = auth.uid())
        OR public.is_tutor()
    );
