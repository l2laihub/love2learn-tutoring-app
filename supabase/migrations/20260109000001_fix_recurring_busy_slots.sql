-- Migration: Fix busy slots to include recurring lesson patterns
-- Version: 20260109000001
-- Description: Updates get_busy_slots_for_date to also check for recurring lessons
--              by looking at the same day of week from recent weeks
--              Uses lesson_sessions for combined session durations

-- Drop existing function first
DROP FUNCTION IF EXISTS get_busy_slots_for_date(DATE);

-- Recreate the function with recurring lesson pattern detection
CREATE OR REPLACE FUNCTION get_busy_slots_for_date(check_date DATE)
RETURNS TABLE (
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    slot_type TEXT
) AS $$
DECLARE
    target_dow INTEGER;
    reference_date DATE;
BEGIN
    -- Get the day of week for the target date (0=Sunday, 6=Saturday)
    target_dow := EXTRACT(DOW FROM check_date)::INTEGER;

    -- Find a reference date (same day of week from the past 4 weeks)
    -- that has scheduled lessons to use as a pattern
    SELECT DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles')
    INTO reference_date
    FROM scheduled_lessons sl
    WHERE sl.status = 'scheduled'
    AND EXTRACT(DOW FROM sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') = target_dow
    AND DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') < check_date
    AND DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') >= check_date - INTERVAL '28 days'
    ORDER BY sl.scheduled_at DESC
    LIMIT 1;

    RETURN QUERY

    -- Get combined sessions on the target date (uses session duration for full block)
    SELECT
        ls.scheduled_at as start_time,
        ls.scheduled_at + (ls.duration_min || ' minutes')::INTERVAL as end_time,
        'session'::TEXT as slot_type
    FROM lesson_sessions ls
    WHERE DATE(ls.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date

    UNION ALL

    -- Get individual lessons on target date that are NOT part of a session
    SELECT
        sl.scheduled_at as start_time,
        sl.scheduled_at + (sl.duration_min || ' minutes')::INTERVAL as end_time,
        'lesson'::TEXT as slot_type
    FROM scheduled_lessons sl
    WHERE DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date
    AND sl.status = 'scheduled'
    AND sl.session_id IS NULL

    UNION ALL

    -- Get recurring SESSION patterns from reference date (for combined lessons)
    SELECT
        (check_date || ' ' || (ls.scheduled_at AT TIME ZONE 'America/Los_Angeles')::TIME)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles' as start_time,
        (check_date || ' ' || (ls.scheduled_at AT TIME ZONE 'America/Los_Angeles')::TIME)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles' + (ls.duration_min || ' minutes')::INTERVAL as end_time,
        'recurring_session'::TEXT as slot_type
    FROM lesson_sessions ls
    WHERE reference_date IS NOT NULL
    AND DATE(ls.scheduled_at AT TIME ZONE 'America/Los_Angeles') = reference_date
    AND NOT EXISTS (
        SELECT 1 FROM lesson_sessions ls2
        WHERE DATE(ls2.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date
    )
    AND NOT EXISTS (
        SELECT 1 FROM scheduled_lessons sl2
        WHERE DATE(sl2.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date
        AND sl2.status = 'scheduled'
    )

    UNION ALL

    -- Get recurring INDIVIDUAL lesson patterns from reference date (non-session lessons only)
    SELECT
        (check_date || ' ' || (sl.scheduled_at AT TIME ZONE 'America/Los_Angeles')::TIME)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles' as start_time,
        (check_date || ' ' || (sl.scheduled_at AT TIME ZONE 'America/Los_Angeles')::TIME)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles' + (sl.duration_min || ' minutes')::INTERVAL as end_time,
        'recurring_lesson'::TEXT as slot_type
    FROM scheduled_lessons sl
    WHERE reference_date IS NOT NULL
    AND DATE(sl.scheduled_at AT TIME ZONE 'America/Los_Angeles') = reference_date
    AND sl.status = 'scheduled'
    AND sl.session_id IS NULL
    AND NOT EXISTS (
        SELECT 1 FROM scheduled_lessons sl2
        WHERE DATE(sl2.scheduled_at AT TIME ZONE 'America/Los_Angeles') = check_date
        AND sl2.status = 'scheduled'
    )

    UNION ALL

    -- Get recurring breaks for this day of week
    SELECT
        ((check_date || ' ' || tb.start_time)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles') as start_time,
        ((check_date || ' ' || tb.end_time)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles') as end_time,
        'break'::TEXT as slot_type
    FROM tutor_breaks tb
    WHERE tb.is_recurring = true
    AND tb.day_of_week = target_dow

    UNION ALL

    -- Get specific date breaks
    SELECT
        ((tb.specific_date || ' ' || tb.start_time)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles') as start_time,
        ((tb.specific_date || ' ' || tb.end_time)::TIMESTAMP AT TIME ZONE 'America/Los_Angeles') as end_time,
        'break'::TEXT as slot_type
    FROM tutor_breaks tb
    WHERE tb.is_recurring = false
    AND tb.specific_date = check_date

    ORDER BY start_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_busy_slots_for_date(DATE) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_busy_slots_for_date(DATE) IS 'Returns busy time slots for a given date including scheduled lessons, recurring lesson patterns from previous weeks, and breaks';
