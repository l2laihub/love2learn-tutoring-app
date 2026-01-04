-- Fix ALL Scenario A combined sessions
-- Scenario A: Each student in the session takes ONE subject (regardless of which subject)
-- In this case, session duration should be divided equally among all students
--
-- Example: An Bui (Speech) + Long Bui (Piano) in a 60min session
-- Each should get 30min, but An Bui was incorrectly set to 60min (Speech base duration)
--
-- The root cause: Previous code used subject base duration for multi-subject sessions,
-- but should only do that when the SAME student takes multiple subjects.

-- Step 1: Identify Scenario A sessions
-- These are sessions where each student has exactly ONE lesson
CREATE TEMP TABLE scenario_a_sessions AS
SELECT sl.session_id
FROM public.scheduled_lessons sl
WHERE sl.session_id IS NOT NULL
GROUP BY sl.session_id
HAVING COUNT(*) = COUNT(DISTINCT sl.student_id);  -- Each student has exactly 1 lesson

-- Step 2: For each Scenario A session, calculate what the per-lesson duration should be
-- We need to determine the original intended session duration
-- Since lesson_sessions.duration_min might be corrupted, we'll use a heuristic:
-- - If all lessons have the same duration, that's likely correct
-- - If durations differ, use the minimum duration × lesson_count as the session total
CREATE TEMP TABLE session_corrections AS
SELECT
  sl.session_id,
  COUNT(*) as lesson_count,
  MIN(sl.duration_min) as min_duration,
  MAX(sl.duration_min) as max_duration,
  -- If durations are equal, use that. Otherwise use min as the "correct" per-student duration
  MIN(sl.duration_min) as correct_per_lesson_duration
FROM public.scheduled_lessons sl
WHERE sl.session_id IN (SELECT session_id FROM scenario_a_sessions)
GROUP BY sl.session_id;

-- Step 3: Update lessons that have incorrect duration
UPDATE public.scheduled_lessons sl
SET duration_min = sc.correct_per_lesson_duration
FROM session_corrections sc
WHERE sl.session_id = sc.session_id
  AND sl.duration_min != sc.correct_per_lesson_duration;

-- Step 4: Update lesson_sessions to have correct total duration
UPDATE public.lesson_sessions ls
SET duration_min = sc.correct_per_lesson_duration * sc.lesson_count
FROM session_corrections sc
WHERE ls.id = sc.session_id
  AND ls.duration_min != (sc.correct_per_lesson_duration * sc.lesson_count);

-- Clean up temp tables
DROP TABLE IF EXISTS scenario_a_sessions;
DROP TABLE IF EXISTS session_corrections;
