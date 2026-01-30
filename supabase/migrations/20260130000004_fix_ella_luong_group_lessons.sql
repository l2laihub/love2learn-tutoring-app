-- Fix Ella Luong group lesson durations
--
-- Issue: Group lessons for Math on Jan 22 and Jan 29, 2026 have incorrect durations.
-- Both lessons show 30min instead of 60min.
--
-- For group lessons (multiple students learning the SAME subject together),
-- each student should be billed for the FULL session duration.
--
-- Fix 1: Jan 22, 2026 - Ella Luong's standalone Math lesson
--        Currently: 30min (wrong)
--        Should be: 60min
--
-- Fix 2: Jan 29, 2026 - Group Math session with Ella Luong + Lucas Duong
--        Currently: session_duration=30, each lesson=30min (wrong)
--        Should be: session_duration=60, each lesson=60min

-- Step 1: Fix the standalone lesson on Jan 22
-- Ella Luong's Math lesson that has no session_id but wrong duration
UPDATE public.scheduled_lessons
SET duration_min = 60
WHERE id = '1468532c-33d5-4052-935c-ec050caa5fe5'  -- Ella Luong's Jan 22 lesson
  AND duration_min = 30;

-- Step 2: Fix the Jan 29 session duration
UPDATE public.lesson_sessions
SET duration_min = 60
WHERE id = 'd341f256-4ebe-4c8f-8e34-9a05075734f0'  -- Jan 29 group session
  AND duration_min = 30;

-- Step 3: Fix all lessons in the Jan 29 session
UPDATE public.scheduled_lessons
SET duration_min = 60
WHERE session_id = 'd341f256-4ebe-4c8f-8e34-9a05075734f0'  -- Jan 29 group session
  AND duration_min = 30;

-- Also fix any other group lessons that might have this issue
-- (same subject, multiple students, but incorrect split duration)
-- This broader fix ensures we catch any other affected records

-- Step 4: Fix all group sessions where:
-- - All lessons have the same subject (group lesson)
-- - Session duration seems to be split incorrectly
WITH group_sessions_to_fix AS (
  SELECT
    sl.session_id,
    COUNT(DISTINCT sl.student_id) as student_count,
    MIN(sl.duration_min) as current_lesson_duration,
    ls.duration_min as current_session_duration
  FROM public.scheduled_lessons sl
  JOIN public.lesson_sessions ls ON ls.id = sl.session_id
  WHERE sl.session_id IS NOT NULL
  GROUP BY sl.session_id, ls.duration_min
  HAVING
    COUNT(DISTINCT sl.subject) = 1  -- Same subject = group lesson
    AND COUNT(DISTINCT sl.student_id) > 1  -- Multiple students
    -- Session duration equals lesson duration (both incorrectly split)
    AND ls.duration_min = MIN(sl.duration_min)
    -- Both are likely split values (30, 20, 15, etc.)
    AND MIN(sl.duration_min) IN (15, 20, 30)
)
-- Update lesson_sessions first
UPDATE public.lesson_sessions ls
SET duration_min = gsf.current_lesson_duration * gsf.student_count
FROM group_sessions_to_fix gsf
WHERE ls.id = gsf.session_id;

-- Step 5: Fix all lessons in those group sessions
WITH group_sessions AS (
  SELECT
    sl.session_id,
    ls.duration_min as session_duration,
    COUNT(DISTINCT sl.student_id) as student_count
  FROM public.scheduled_lessons sl
  JOIN public.lesson_sessions ls ON ls.id = sl.session_id
  WHERE sl.session_id IS NOT NULL
  GROUP BY sl.session_id, ls.duration_min
  HAVING
    COUNT(DISTINCT sl.subject) = 1  -- Same subject = group lesson
    AND COUNT(DISTINCT sl.student_id) > 1  -- Multiple students
)
UPDATE public.scheduled_lessons sl
SET duration_min = gs.session_duration
FROM group_sessions gs
WHERE sl.session_id = gs.session_id
  AND sl.duration_min < gs.session_duration;  -- Only update if currently less than session
