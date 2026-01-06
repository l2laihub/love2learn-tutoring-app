-- Migration: Fix lesson_requests foreign key constraint
-- Version: 20260106000002
-- Description: Modify scheduled_lesson_id foreign key to SET NULL on delete
--              This allows scheduled lessons to be deleted without blocking on
--              existing lesson_requests that reference them

-- ============================================================================
-- DROP EXISTING CONSTRAINT AND ADD NEW ONE WITH ON DELETE SET NULL
-- ============================================================================

-- First, drop the existing foreign key constraint
ALTER TABLE lesson_requests
DROP CONSTRAINT IF EXISTS lesson_requests_scheduled_lesson_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE lesson_requests
ADD CONSTRAINT lesson_requests_scheduled_lesson_id_fkey
FOREIGN KEY (scheduled_lesson_id)
REFERENCES scheduled_lessons(id)
ON DELETE SET NULL;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON COLUMN lesson_requests.scheduled_lesson_id IS 'Links to the scheduled lesson when request is approved. Set to NULL when the lesson is deleted.';
