-- Migration: Tutor Break Slots
-- Version: 20260107000001
-- Description: Creates tutor_breaks table for tutors to mark break times within their availability

-- ============================================================================
-- CREATE TUTOR BREAKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS tutor_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_recurring BOOLEAN DEFAULT true,
    specific_date DATE, -- For one-time breaks
    notes TEXT, -- Free-form notes for the break
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure end_time is after start_time
    CONSTRAINT valid_break_time_range CHECK (end_time > start_time),
    -- For recurring breaks, day_of_week is required
    CONSTRAINT recurring_break_requires_day CHECK (
        (is_recurring = true AND day_of_week IS NOT NULL) OR
        (is_recurring = false AND specific_date IS NOT NULL)
    )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tutor_breaks_tutor_id ON tutor_breaks(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_breaks_day ON tutor_breaks(day_of_week) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tutor_breaks_date ON tutor_breaks(specific_date) WHERE is_recurring = false;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tutor_breaks IS 'Stores tutor break time slots within their availability windows';
COMMENT ON COLUMN tutor_breaks.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday. Required for recurring breaks.';
COMMENT ON COLUMN tutor_breaks.is_recurring IS 'If true, break repeats weekly. If false, specific_date is used.';
COMMENT ON COLUMN tutor_breaks.specific_date IS 'For one-time breaks. Required when is_recurring is false.';
COMMENT ON COLUMN tutor_breaks.notes IS 'Free-form notes describing the break (e.g., lunch, personal, etc.)';

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE tutor_breaks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Tutors can manage their own breaks
CREATE POLICY "Tutors can manage their breaks"
    ON tutor_breaks
    FOR ALL
    USING (
        tutor_id IN (SELECT id FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    )
    WITH CHECK (
        tutor_id IN (SELECT id FROM parents WHERE user_id = auth.uid() AND role = 'tutor')
    );

-- Parents should NOT see break details (breaks appear as "unavailable" in scheduling)
-- No SELECT policy for parents - they query available slots minus breaks via function

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tutor_breaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tutor_breaks_updated_at ON tutor_breaks;
CREATE TRIGGER tutor_breaks_updated_at
    BEFORE UPDATE ON tutor_breaks
    FOR EACH ROW
    EXECUTE FUNCTION update_tutor_breaks_updated_at();

-- ============================================================================
-- UPDATE BUSY SLOTS FUNCTION TO INCLUDE BREAKS
-- ============================================================================

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS get_busy_slots_for_date(DATE);

-- Recreate the function to include breaks
CREATE OR REPLACE FUNCTION get_busy_slots_for_date(check_date DATE)
RETURNS TABLE (
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    slot_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Get scheduled lessons
    SELECT
        sl.scheduled_at as start_time,
        sl.scheduled_at + (sl.duration_min || ' minutes')::INTERVAL as end_time,
        'lesson'::TEXT as slot_type
    FROM scheduled_lessons sl
    WHERE DATE(sl.scheduled_at) = check_date
    AND sl.status = 'scheduled'

    UNION ALL

    -- Get recurring breaks for this day of week
    SELECT
        (check_date || ' ' || tb.start_time)::TIMESTAMPTZ as start_time,
        (check_date || ' ' || tb.end_time)::TIMESTAMPTZ as end_time,
        'break'::TEXT as slot_type
    FROM tutor_breaks tb
    WHERE tb.is_recurring = true
    AND tb.day_of_week = EXTRACT(DOW FROM check_date)::INTEGER

    UNION ALL

    -- Get specific date breaks
    SELECT
        (tb.specific_date || ' ' || tb.start_time)::TIMESTAMPTZ as start_time,
        (tb.specific_date || ' ' || tb.end_time)::TIMESTAMPTZ as end_time,
        'break'::TEXT as slot_type
    FROM tutor_breaks tb
    WHERE tb.is_recurring = false
    AND tb.specific_date = check_date

    ORDER BY start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_busy_slots_for_date(DATE) TO authenticated;
