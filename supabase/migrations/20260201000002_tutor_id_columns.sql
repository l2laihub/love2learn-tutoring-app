-- Migration: Add tutor_id columns for multi-tutor data isolation
-- Version: 20260201000002
-- Description: Adds tutor_id column to tables that need data isolation between tutors
--
-- This migration adds tutor_id foreign keys to enable:
-- - Data isolation between different tutors
-- - Students belonging to a specific tutor's business
-- - Parents linked to their tutor
-- - Messages, notifications, and resources scoped to a tutor
--
-- Note: shared_resources already has a tutor_id column, so we skip it here

-- ============================================================================
-- ADD TUTOR_ID TO STUDENTS TABLE
-- ============================================================================

-- Students belong to a tutor (the tutoring business)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN students.tutor_id IS 'The tutor (business) this student belongs to';

-- Index for tutor_id lookups
CREATE INDEX IF NOT EXISTS idx_students_tutor_id
ON students(tutor_id)
WHERE tutor_id IS NOT NULL;

-- ============================================================================
-- ADD TUTOR_ID TO PARENTS TABLE (for non-tutor parents)
-- ============================================================================

-- Link parents to the tutor they work with
-- This allows a parent account to be associated with a specific tutor's business
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN parents.tutor_id IS 'For parent role: the tutor this parent is associated with. NULL for tutor role.';

-- Index for tutor_id lookups (only for parents, not tutors)
CREATE INDEX IF NOT EXISTS idx_parents_tutor_id
ON parents(tutor_id)
WHERE tutor_id IS NOT NULL AND role = 'parent';

-- ============================================================================
-- ADD TUTOR_ID TO MESSAGE_THREADS TABLE
-- ============================================================================

-- Message threads belong to a tutor's business
ALTER TABLE message_threads
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN message_threads.tutor_id IS 'The tutor (business) this message thread belongs to';

-- Index for tutor_id lookups
CREATE INDEX IF NOT EXISTS idx_message_threads_tutor_id
ON message_threads(tutor_id)
WHERE tutor_id IS NOT NULL;

-- ============================================================================
-- ADD TUTOR_ID TO NOTIFICATIONS TABLE
-- ============================================================================

-- Notifications are scoped to a tutor's business
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN notifications.tutor_id IS 'The tutor (business) this notification belongs to';

-- Index for tutor_id lookups
CREATE INDEX IF NOT EXISTS idx_notifications_tutor_id
ON notifications(tutor_id)
WHERE tutor_id IS NOT NULL;

-- ============================================================================
-- ADD TUTOR_ID TO PARENT_GROUPS TABLE
-- ============================================================================

-- Parent groups belong to a tutor
ALTER TABLE parent_groups
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN parent_groups.tutor_id IS 'The tutor (business) this parent group belongs to';

-- Index for tutor_id lookups
CREATE INDEX IF NOT EXISTS idx_parent_groups_tutor_id
ON parent_groups(tutor_id)
WHERE tutor_id IS NOT NULL;

-- ============================================================================
-- NOTE: SHARED_RESOURCES ALREADY HAS TUTOR_ID
-- ============================================================================
-- The shared_resources table was created with a tutor_id column in migration
-- 20260105000001_shared_resources.sql. No changes needed here.

-- ============================================================================
-- ADD TUTOR_ID TO ADDITIONAL RELATED TABLES
-- ============================================================================

-- Payments should also be scoped to a tutor for reporting
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN payments.tutor_id IS 'The tutor (business) this payment belongs to';

CREATE INDEX IF NOT EXISTS idx_payments_tutor_id
ON payments(tutor_id)
WHERE tutor_id IS NOT NULL;

-- Scheduled lessons should be scoped to a tutor
ALTER TABLE scheduled_lessons
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN scheduled_lessons.tutor_id IS 'The tutor (business) this lesson belongs to';

CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_tutor_id
ON scheduled_lessons(tutor_id)
WHERE tutor_id IS NOT NULL;

-- Assignments should be scoped to a tutor
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id) ON DELETE SET NULL;

COMMENT ON COLUMN assignments.tutor_id IS 'The tutor (business) this assignment belongs to';

CREATE INDEX IF NOT EXISTS idx_assignments_tutor_id
ON assignments(tutor_id)
WHERE tutor_id IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTION: Get current user's tutor_id
-- ============================================================================

-- Function to get the tutor_id for the current user
-- If user is a tutor, returns their own ID
-- If user is a parent, returns their associated tutor_id
CREATE OR REPLACE FUNCTION get_current_tutor_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
BEGIN
  SELECT id, role, tutor_id INTO v_parent
  FROM parents
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If user is a tutor, return their own ID
  IF v_parent.role = 'tutor' THEN
    RETURN v_parent.id;
  END IF;

  -- If user is a parent, return their associated tutor_id
  RETURN v_parent.tutor_id;
END;
$$;

COMMENT ON FUNCTION get_current_tutor_id() IS 'Returns the tutor_id for the current user. For tutors, returns own ID. For parents, returns their associated tutor.';

GRANT EXECUTE ON FUNCTION get_current_tutor_id() TO authenticated;
