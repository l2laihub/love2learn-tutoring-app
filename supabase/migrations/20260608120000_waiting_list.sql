-- Migration: Waiting List
-- Version: 20260608120000
-- Description: Tracks inquiries from prospective (new) parents per tutor.
--   Public form submissions are inserted by the submit-inquiry edge function
--   (service role). The table is never exposed to the anon role.

-- ============================================================================
-- STATUS ENUM (CHECK constraint, matching lesson_requests convention)
-- ============================================================================
-- Lifecycle: new -> contacted -> waitlisted -> converted | declined

-- ============================================================================
-- TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS waiting_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,

    -- Prospective parent contact
    parent_name TEXT NOT NULL,
    parent_email TEXT,
    parent_phone TEXT,

    -- Student details (single student per inquiry)
    student_name TEXT,
    student_age INTEGER,
    student_grade TEXT,

    -- Interest
    subjects TEXT[] NOT NULL DEFAULT '{}',
    preferred_availability TEXT,
    message TEXT,
    referral_source TEXT,

    -- Tutor-managed
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'contacted', 'waitlisted', 'converted', 'declined')),
    tutor_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- At least one way to follow up
    CONSTRAINT waiting_list_contact_present
        CHECK (parent_email IS NOT NULL OR parent_phone IS NOT NULL)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_waiting_list_tutor_status
    ON waiting_list(tutor_id, status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_created_at
    ON waiting_list(created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE waiting_list IS 'Inquiries from prospective new parents, per tutor';
COMMENT ON COLUMN waiting_list.status IS 'new | contacted | waitlisted | converted | declined';
COMMENT ON COLUMN waiting_list.tutor_notes IS 'Private notes the tutor adds about the inquiry';

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- Tutors may read only their own inquiries.
CREATE POLICY "Tutors can view own waiting list"
    ON waiting_list
    FOR SELECT
    USING (is_tutor() AND tutor_id = get_current_tutor_id());

-- Tutors may update only their own inquiries (status + notes).
CREATE POLICY "Tutors can update own waiting list"
    ON waiting_list
    FOR UPDATE
    USING (is_tutor() AND tutor_id = get_current_tutor_id())
    WITH CHECK (is_tutor() AND tutor_id = get_current_tutor_id());

-- Tutors may delete only their own inquiries.
CREATE POLICY "Tutors can delete own waiting list"
    ON waiting_list
    FOR DELETE
    USING (is_tutor() AND tutor_id = get_current_tutor_id());

-- NOTE: No INSERT policy and no anon policies. Public submissions are inserted
-- exclusively by the submit-inquiry edge function using the service role, which
-- bypasses RLS.

-- ============================================================================
-- TRIGGER: keep updated_at fresh
-- ============================================================================
CREATE OR REPLACE FUNCTION update_waiting_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waiting_list_updated_at ON waiting_list;
CREATE TRIGGER waiting_list_updated_at
    BEFORE UPDATE ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION update_waiting_list_updated_at();
