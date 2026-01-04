-- Migration: Tutor Availability Slots
-- Version: 20260103000004
-- Description: Creates tutor_availability table for parents to see available time slots

-- ============================================================================
-- CREATE TUTOR AVAILABILITY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tutor_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring BOOLEAN DEFAULT true,
    specific_date DATE, -- For one-time availability slots
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure end_time is after start_time
    CONSTRAINT valid_time_range CHECK (end_time > start_time),
    -- For recurring slots, day_of_week is required
    CONSTRAINT recurring_requires_day CHECK (
        (is_recurring = true AND day_of_week IS NOT NULL) OR
        (is_recurring = false AND specific_date IS NOT NULL)
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tutor_availability_tutor_id ON tutor_availability(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_availability_day ON tutor_availability(day_of_week) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tutor_availability_date ON tutor_availability(specific_date) WHERE is_recurring = false;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tutor_availability IS 'Stores tutor available time slots for parents to view and request lessons';
COMMENT ON COLUMN tutor_availability.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday. Required for recurring slots.';
COMMENT ON COLUMN tutor_availability.is_recurring IS 'If true, slot repeats weekly. If false, specific_date is used.';
COMMENT ON COLUMN tutor_availability.specific_date IS 'For one-time availability slots. Required when is_recurring is false.';

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE tutor_availability ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Tutors can manage their own availability
CREATE POLICY "Tutors can manage their availability"
    ON tutor_availability
    FOR ALL
    USING (
        tutor_id IN (SELECT id FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    )
    WITH CHECK (
        tutor_id IN (SELECT id FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    );

-- Parents can view tutor availability (read-only)
CREATE POLICY "Parents can view tutor availability"
    ON tutor_availability
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents WHERE user_id = auth.uid() AND role = 'parent'
        )
    );

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tutor_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tutor_availability_updated_at ON tutor_availability;
CREATE TRIGGER tutor_availability_updated_at
    BEFORE UPDATE ON tutor_availability
    FOR EACH ROW
    EXECUTE FUNCTION update_tutor_availability_updated_at();
