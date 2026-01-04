-- Fix combined session lesson durations
--
-- There are TWO scenarios for combined sessions:
--
-- Scenario A: Each student takes ONE subject (even if different subjects)
--   - Long Bui (Piano) + An Bui (Speech) in 60min session
--   - Both should get 30min each (60min / 2 students)
--   - Duration is divided equally regardless of subject
--
-- Scenario B: Same student takes MULTIPLE subjects in one session
--   - Lauren Vu (Piano + Reading) in one session
--   - Use each subject's base duration from tutor settings
--   - Piano=30min, Reading=60min → Lauren gets 30min Piano + 60min Reading
--
-- This migration fixes sessions where Scenario A was incorrectly treated as Scenario B,
-- resulting in wrong durations (e.g., An Bui's Speech showing 60min instead of 30min).

-- Step 1: Create helper function to get base duration for a subject
CREATE OR REPLACE FUNCTION get_subject_base_duration(p_subject tutoring_subject)
RETURNS INTEGER AS $$
DECLARE
  v_base_duration INTEGER;
  v_subject_rates JSONB;
  v_subject_text TEXT;
BEGIN
  v_subject_text := p_subject::TEXT;
  SELECT subject_rates INTO v_subject_rates FROM public.tutor_settings LIMIT 1;

  IF v_subject_rates IS NOT NULL AND v_subject_rates ? v_subject_text THEN
    v_base_duration := (v_subject_rates -> v_subject_text ->> 'base_duration')::INTEGER;
    IF v_base_duration IS NOT NULL AND v_base_duration > 0 THEN
      RETURN v_base_duration;
    END IF;
  END IF;

  SELECT COALESCE(default_base_duration, 60) INTO v_base_duration FROM public.tutor_settings LIMIT 1;
  RETURN COALESCE(v_base_duration, 60);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Fix Scenario A sessions (each student has ONE subject)
-- These sessions should have duration divided equally, not by subject base duration
WITH scenario_a_sessions AS (
  -- Find sessions where NO student has multiple subjects
  -- (count lessons per student in each session, exclude sessions where any student has >1 lesson)
  SELECT DISTINCT sl.session_id
  FROM public.scheduled_lessons sl
  WHERE sl.session_id IS NOT NULL
    AND sl.session_id NOT IN (
      -- Exclude sessions where any student has multiple lessons (Scenario B)
      SELECT session_id
      FROM public.scheduled_lessons
      WHERE session_id IS NOT NULL
      GROUP BY session_id, student_id
      HAVING COUNT(*) > 1
    )
),
session_info AS (
  -- Get lesson count and session duration for each Scenario A session
  SELECT
    sl.session_id,
    COUNT(*) as lesson_count,
    ls.duration_min as session_duration
  FROM public.scheduled_lessons sl
  JOIN public.lesson_sessions ls ON ls.id = sl.session_id
  WHERE sl.session_id IN (SELECT session_id FROM scenario_a_sessions)
  GROUP BY sl.session_id, ls.duration_min
)
UPDATE public.scheduled_lessons sl
SET duration_min = si.session_duration / si.lesson_count
FROM session_info si
WHERE sl.session_id = si.session_id
  AND sl.duration_min != (si.session_duration / si.lesson_count);

-- Step 3: Fix Scenario B sessions (student has MULTIPLE subjects)
-- These sessions should use each subject's base duration
WITH scenario_b_sessions AS (
  -- Find sessions where at least one student has multiple lessons
  SELECT DISTINCT session_id
  FROM public.scheduled_lessons
  WHERE session_id IS NOT NULL
  GROUP BY session_id, student_id
  HAVING COUNT(*) > 1
)
UPDATE public.scheduled_lessons sl
SET duration_min = get_subject_base_duration(sl.subject)
FROM scenario_b_sessions sb
WHERE sl.session_id = sb.session_id;

-- Step 4: Update lesson_sessions total duration to match sum of lessons
WITH session_totals AS (
  SELECT
    session_id,
    SUM(duration_min) as total_duration
  FROM public.scheduled_lessons
  WHERE session_id IS NOT NULL
  GROUP BY session_id
)
UPDATE public.lesson_sessions ls
SET duration_min = st.total_duration
FROM session_totals st
WHERE ls.id = st.session_id
  AND ls.duration_min != st.total_duration;

-- Clean up
DROP FUNCTION IF EXISTS get_subject_base_duration(tutoring_subject);

-- Document the fix
COMMENT ON TABLE public.scheduled_lessons IS
  'Scheduled tutoring lessons. Combined session duration logic: If each student has one subject, duration is divided equally. If a student has multiple subjects, each subject uses its configured base duration.';
