-- Migration: Fix Busy Slots Function
-- Version: 20260104000003
-- Description: Updates function to return TIME instead of TIMESTAMPTZ for easier comparison

-- ============================================================================
-- UPDATE FUNCTION TO RETURN TIME VALUES
-- ============================================================================
-- Return time strings (HH:MM:SS) instead of full timestamps to avoid timezone issues
-- Groups lessons by scheduled_at time and SUMS their durations (for group lessons)
-- E.g., An Bui (30min) + Long Bui (30min) at same time = 60min total busy slot
-- This makes client-side comparison much simpler

DROP FUNCTION IF EXISTS get_busy_slots_for_date(DATE);

CREATE OR REPLACE FUNCTION get_busy_slots_for_date(check_date DATE)
RETURNS TABLE (
    start_time TIME,
    end_time TIME
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (sl.scheduled_at AT TIME ZONE 'America/Los_Angeles')::TIME AS start_time,
        ((sl.scheduled_at + (SUM(sl.duration_min) || ' minutes')::INTERVAL) AT TIME ZONE 'America/Los_Angeles')::TIME AS end_time
    FROM scheduled_lessons sl
    WHERE
        DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date
        AND sl.status = 'scheduled'
    GROUP BY sl.scheduled_at
    ORDER BY start_time;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_busy_slots_for_date(DATE) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_busy_slots_for_date(DATE) IS
    'Returns busy time slots (as TIME values) for a date. Sums durations for grouped lessons. Used to show booked slots when parents request reschedules.';
