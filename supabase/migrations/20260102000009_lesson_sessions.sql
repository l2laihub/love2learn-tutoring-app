-- Migration: Add lesson_sessions table for grouped lessons
-- Version: 20260102000009
-- Description: Creates a lesson_sessions table to group related lessons together.
--              This supports scenarios like siblings taking combined classes
--              (e.g., Lian & Lauren Vu taking Piano & Reading from 3:30-6:30pm).

-- ============================================================================
-- CREATE LESSON_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Session timing
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,

    -- Optional notes for the entire session
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for querying sessions by date
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_scheduled_at
ON lesson_sessions(scheduled_at);

-- Add updated_at trigger
CREATE TRIGGER update_lesson_sessions_updated_at
    BEFORE UPDATE ON lesson_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ADD SESSION_ID TO SCHEDULED_LESSONS
-- ============================================================================

-- Add nullable foreign key to link lessons to sessions
ALTER TABLE scheduled_lessons
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES lesson_sessions(id) ON DELETE SET NULL;

-- Add index for querying lessons by session
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_session_id
ON scheduled_lessons(session_id);

-- ============================================================================
-- ROW LEVEL SECURITY FOR LESSON_SESSIONS
-- ============================================================================

-- Enable RLS
ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;

-- Tutors can do everything with sessions
CREATE POLICY "Tutors can manage all lesson sessions"
ON lesson_sessions
FOR ALL
TO authenticated
USING (public.is_tutor())
WITH CHECK (public.is_tutor());

-- Parents can view sessions that contain their children's lessons
CREATE POLICY "Parents can view their children's lesson sessions"
ON lesson_sessions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM scheduled_lessons sl
        JOIN students s ON sl.student_id = s.id
        WHERE sl.session_id = lesson_sessions.id
        AND s.parent_id = public.get_parent_id()
    )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE lesson_sessions IS 'Groups related lessons together (e.g., siblings taking combined classes)';
COMMENT ON COLUMN lesson_sessions.scheduled_at IS 'Start time of the session';
COMMENT ON COLUMN lesson_sessions.duration_min IS 'Total duration of the session in minutes';
COMMENT ON COLUMN lesson_sessions.notes IS 'Notes for the entire session';
COMMENT ON COLUMN scheduled_lessons.session_id IS 'Optional link to group this lesson with others in a session';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After running this migration, verify with:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lesson_sessions';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scheduled_lessons' AND column_name = 'session_id';
