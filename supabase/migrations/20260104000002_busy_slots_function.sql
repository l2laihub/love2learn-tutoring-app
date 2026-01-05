-- Migration: Busy Slots Function
-- Version: 20260104000002
-- Description: Creates a function to get busy time slots for a date (for reschedule requests)

-- ============================================================================
-- CREATE FUNCTION TO GET BUSY TIME SLOTS
-- ============================================================================
-- This function returns all busy time slots for a given date without exposing student info
-- Used by parents when requesting to reschedule lessons

CREATE OR REPLACE FUNCTION get_busy_slots_for_date(check_date DATE)
RETURNS TABLE (
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.scheduled_at AS start_time,
        (sl.scheduled_at + (sl.duration_min || ' minutes')::INTERVAL) AS end_time
    FROM scheduled_lessons sl
    WHERE
        DATE(sl.scheduled_at) = check_date
        AND sl.status = 'scheduled';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_busy_slots_for_date(DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_busy_slots_for_date(DATE) IS
    'Returns busy time slots for a date. Used to show booked slots when parents request reschedules.';
