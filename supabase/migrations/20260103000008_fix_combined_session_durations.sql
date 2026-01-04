-- Fix combined session lesson durations
-- Previously, each lesson in a combined session was storing the TOTAL session duration
-- instead of each student's individual portion.
-- For example: 2 students in a 60-min session should each have 30min, not 60min

-- This migration updates existing combined session lessons to have the correct per-student duration
-- by dividing the session duration by the number of lessons in that session

-- Step 1: Create a temporary table with the correct durations
WITH session_counts AS (
  SELECT
    session_id,
    COUNT(*) as lesson_count
  FROM public.scheduled_lessons
  WHERE session_id IS NOT NULL
  GROUP BY session_id
),
session_durations AS (
  SELECT
    ls.id as session_id,
    ls.duration_min as total_duration
  FROM public.lesson_sessions ls
)
UPDATE public.scheduled_lessons sl
SET duration_min = sd.total_duration / sc.lesson_count
FROM session_counts sc
JOIN session_durations sd ON sd.session_id = sc.session_id
WHERE sl.session_id = sc.session_id
  AND sl.session_id IS NOT NULL
  AND sl.duration_min = sd.total_duration -- Only update if duration equals total (not already fixed)
  AND sc.lesson_count > 1; -- Only fix sessions with multiple students

-- Add a comment documenting this fix
COMMENT ON COLUMN public.scheduled_lessons.duration_min IS
  'Duration in minutes for this specific student''s lesson. For combined sessions, this is the individual student''s portion (session_duration / number_of_students).';
