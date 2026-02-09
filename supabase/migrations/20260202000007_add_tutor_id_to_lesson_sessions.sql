-- Migration: Add tutor_id to lesson_sessions table
-- Version: 20260202000007
-- Description: The lesson_sessions table was missing tutor_id column,
--              causing the get_busy_slots_for_date function to fail.
--              This migration adds the column and backfills existing data.

-- ============================================================================
-- ADD TUTOR_ID COLUMN TO LESSON_SESSIONS
-- ============================================================================

-- Add the tutor_id column
ALTER TABLE lesson_sessions
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_tutor_id
ON lesson_sessions(tutor_id);

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Set tutor_id based on the scheduled_lessons that belong to each session
UPDATE lesson_sessions ls
SET tutor_id = (
    SELECT sl.tutor_id
    FROM scheduled_lessons sl
    WHERE sl.session_id = ls.id
    LIMIT 1
)
WHERE ls.tutor_id IS NULL;

-- ============================================================================
-- FIX RLS POLICY FOR MULTI-TUTOR
-- ============================================================================

-- Drop old policy that allows any tutor to manage all sessions
DROP POLICY IF EXISTS "Tutors can manage all lesson sessions" ON lesson_sessions;

-- Create policy that restricts tutors to their own sessions
CREATE POLICY "Tutors can manage their lesson sessions"
ON lesson_sessions
FOR ALL
TO authenticated
USING (
    is_tutor() AND (
        tutor_id = get_current_tutor_id()
        OR tutor_id IS NULL  -- Allow managing sessions without tutor_id (legacy)
    )
)
WITH CHECK (
    is_tutor() AND (
        tutor_id = get_current_tutor_id()
        OR tutor_id IS NULL
    )
);

-- ============================================================================
-- ADD TRIGGER TO AUTO-SET TUTOR_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION set_lesson_session_tutor_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If tutor_id not provided, set it to current tutor
    IF NEW.tutor_id IS NULL THEN
        NEW.tutor_id := get_current_tutor_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_set_lesson_session_tutor_id ON lesson_sessions;
CREATE TRIGGER trigger_set_lesson_session_tutor_id
    BEFORE INSERT ON lesson_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_lesson_session_tutor_id();

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON COLUMN lesson_sessions.tutor_id IS 'The tutor who owns this session';
