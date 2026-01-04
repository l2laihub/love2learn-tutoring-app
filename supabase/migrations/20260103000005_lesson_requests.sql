-- Migration: Lesson Requests
-- Version: 20260103000005
-- Description: Creates lesson_requests table for parents to request new lessons

-- ============================================================================
-- CREATE LESSON REQUEST STATUS ENUM
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_request_status') THEN
        CREATE TYPE lesson_request_status AS ENUM ('pending', 'approved', 'rejected', 'scheduled');
    END IF;
END $$;

-- ============================================================================
-- CREATE LESSON REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS lesson_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time TIME,
    preferred_duration INTEGER DEFAULT 60, -- in minutes
    notes TEXT,
    status lesson_request_status DEFAULT 'pending',
    tutor_response TEXT,
    scheduled_lesson_id UUID REFERENCES scheduled_lessons(id), -- Set when approved and scheduled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_requests_parent_id ON lesson_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_lesson_requests_student_id ON lesson_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_requests_status ON lesson_requests(status);
CREATE INDEX IF NOT EXISTS idx_lesson_requests_date ON lesson_requests(preferred_date);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE lesson_requests IS 'Stores lesson requests from parents to tutors';
COMMENT ON COLUMN lesson_requests.preferred_time IS 'Optional preferred time for the lesson';
COMMENT ON COLUMN lesson_requests.tutor_response IS 'Tutor response message when approving or rejecting';
COMMENT ON COLUMN lesson_requests.scheduled_lesson_id IS 'Links to the scheduled lesson when request is approved';

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE lesson_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Parents can view and create their own requests
CREATE POLICY "Parents can view own lesson requests"
    ON lesson_requests
    FOR SELECT
    USING (
        parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
    );

CREATE POLICY "Parents can create lesson requests"
    ON lesson_requests
    FOR INSERT
    WITH CHECK (
        parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        AND student_id IN (
            SELECT id FROM students WHERE parent_id = (SELECT id FROM parents WHERE user_id = auth.uid())
        )
    );

-- Tutors can view and manage all lesson requests
CREATE POLICY "Tutors can view all lesson requests"
    ON lesson_requests
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    );

CREATE POLICY "Tutors can update lesson requests"
    ON lesson_requests
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    );

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_lesson_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lesson_requests_updated_at ON lesson_requests;
CREATE TRIGGER lesson_requests_updated_at
    BEFORE UPDATE ON lesson_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_lesson_requests_updated_at();
