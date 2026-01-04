-- Debug script to check combined session data
-- Run this in Supabase SQL Editor to see current state

-- 1. Show all lesson_sessions with their total duration
SELECT
  ls.id as session_id,
  ls.duration_min as session_total_duration,
  ls.scheduled_at,
  COUNT(sl.id) as lesson_count
FROM public.lesson_sessions ls
LEFT JOIN public.scheduled_lessons sl ON sl.session_id = ls.id
GROUP BY ls.id, ls.duration_min, ls.scheduled_at
ORDER BY ls.scheduled_at DESC;

-- 2. Show individual lessons in combined sessions
SELECT
  ls.id as session_id,
  ls.duration_min as session_total,
  sl.id as lesson_id,
  st.name as student_name,
  sl.subject,
  sl.duration_min as lesson_duration,
  sl.scheduled_at
FROM public.lesson_sessions ls
JOIN public.scheduled_lessons sl ON sl.session_id = ls.id
JOIN public.students st ON st.id = sl.student_id
ORDER BY ls.scheduled_at DESC, st.name;

-- 3. Find sessions where lesson durations don't match expected
-- For Scenario A (each student has 1 subject), duration should be session_total / lesson_count
SELECT
  ls.id as session_id,
  ls.duration_min as session_total,
  COUNT(sl.id) as lesson_count,
  ls.duration_min / COUNT(sl.id) as expected_per_lesson,
  MIN(sl.duration_min) as actual_min_duration,
  MAX(sl.duration_min) as actual_max_duration,
  CASE
    WHEN MIN(sl.duration_min) = MAX(sl.duration_min)
         AND MIN(sl.duration_min) = ls.duration_min / COUNT(sl.id)
    THEN 'OK'
    ELSE 'MISMATCH'
  END as status
FROM public.lesson_sessions ls
JOIN public.scheduled_lessons sl ON sl.session_id = ls.id
GROUP BY ls.id, ls.duration_min
HAVING COUNT(DISTINCT sl.student_id) = COUNT(sl.id) -- Each student has only 1 lesson (Scenario A)
ORDER BY ls.scheduled_at DESC;

-- 4. Specifically check Kim Tien family sessions (An Bui and Long Bui)
SELECT
  ls.id as session_id,
  ls.duration_min as session_total,
  st.name as student_name,
  sl.subject,
  sl.duration_min as lesson_duration,
  sl.scheduled_at::date as lesson_date
FROM public.lesson_sessions ls
JOIN public.scheduled_lessons sl ON sl.session_id = ls.id
JOIN public.students st ON st.id = sl.student_id
WHERE st.name IN ('An Bui', 'Long Bui')
ORDER BY sl.scheduled_at DESC, st.name;
