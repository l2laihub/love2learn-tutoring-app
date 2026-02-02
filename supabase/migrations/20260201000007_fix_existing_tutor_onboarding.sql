-- Migration: Fix existing tutors onboarding status
-- Version: 20260201000007
-- Description: Sets onboarding_completed_at for existing tutors who were created before
--              the onboarding flow was implemented, preventing redirect loops.

-- ============================================================================
-- FIX EXISTING TUTORS
-- ============================================================================

-- Set onboarding_completed_at for tutors who:
-- 1. Have role = 'tutor'
-- 2. Don't have onboarding_completed_at set yet
-- 3. Have any evidence of being an established tutor (students, lessons, etc.)
--    OR were created before a certain date (pre-onboarding feature)

-- First, update all tutors who have students assigned to them
UPDATE parents
SET
  onboarding_completed_at = COALESCE(created_at, NOW())
WHERE
  role = 'tutor'
  AND onboarding_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM students WHERE students.tutor_id = parents.id
  );

-- Also update tutors who have scheduled lessons
UPDATE parents
SET
  onboarding_completed_at = COALESCE(created_at, NOW())
WHERE
  role = 'tutor'
  AND onboarding_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM scheduled_lessons WHERE scheduled_lessons.tutor_id = parents.id
  );

-- Finally, update any remaining tutors who were created more than 1 day ago
-- (assuming they're legacy accounts that predate the onboarding feature)
UPDATE parents
SET
  onboarding_completed_at = COALESCE(created_at, NOW())
WHERE
  role = 'tutor'
  AND onboarding_completed_at IS NULL
  AND created_at < NOW() - INTERVAL '1 day';

-- ============================================================================
-- LOGGING
-- ============================================================================

-- Report how many tutors were updated
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM parents
  WHERE role = 'tutor' AND onboarding_completed_at IS NOT NULL;

  RAISE NOTICE 'Tutors with onboarding completed: %', v_count;
END $$;
