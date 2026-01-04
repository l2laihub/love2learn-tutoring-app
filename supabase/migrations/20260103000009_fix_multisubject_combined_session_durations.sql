-- Fix multi-subject combined session lesson durations
-- Previously, combined sessions with multiple subjects (e.g., Piano + Reading)
-- would divide the total duration equally among all lessons, which doesn't account
-- for different subjects having different standard durations.
--
-- This migration updates existing multi-subject combined sessions to use
-- each subject's configured base duration from tutor_settings.
--
-- Example: A 180-min session with 2 students × 2 subjects (Piano 30min + Reading 60min)
-- should have: 4 lessons total, Piano lessons get 30min, Reading lessons get 60min
-- Instead of: 4 lessons × 45min each (180/4=45)

-- Step 1: Identify sessions that have multiple subjects (multi-subject sessions)
-- Step 2: Update each lesson's duration to match its subject's base duration

-- First, create a temporary function to get the base duration for a subject
-- Accept tutoring_subject type and cast to text for JSON lookup
CREATE OR REPLACE FUNCTION get_subject_base_duration(p_subject tutoring_subject)
RETURNS INTEGER AS $$
DECLARE
  v_base_duration INTEGER;
  v_subject_rates JSONB;
  v_subject_text TEXT;
BEGIN
  -- Cast the subject enum to text for JSON lookup
  v_subject_text := p_subject::TEXT;

  -- Get subject_rates from tutor_settings (assuming single tutor)
  SELECT subject_rates INTO v_subject_rates
  FROM public.tutor_settings
  LIMIT 1;

  -- Try to get subject-specific base duration
  IF v_subject_rates IS NOT NULL AND v_subject_rates ? v_subject_text THEN
    v_base_duration := (v_subject_rates -> v_subject_text ->> 'base_duration')::INTEGER;
    IF v_base_duration IS NOT NULL AND v_base_duration > 0 THEN
      RETURN v_base_duration;
    END IF;
  END IF;

  -- Fallback: get default base duration from tutor_settings or use 60 as default
  SELECT COALESCE(default_base_duration, 60) INTO v_base_duration
  FROM public.tutor_settings
  LIMIT 1;

  RETURN COALESCE(v_base_duration, 60);
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update lessons in multi-subject combined sessions
-- Multi-subject sessions are those where lessons with the same session_id have different subjects
WITH multi_subject_sessions AS (
  -- Find sessions with more than one distinct subject
  SELECT session_id
  FROM public.scheduled_lessons
  WHERE session_id IS NOT NULL
  GROUP BY session_id
  HAVING COUNT(DISTINCT subject) > 1
)
UPDATE public.scheduled_lessons sl
SET duration_min = get_subject_base_duration(sl.subject)
FROM multi_subject_sessions mss
WHERE sl.session_id = mss.session_id;

-- Step 3: Update the lesson_sessions table to reflect the correct total duration
-- (sum of individual lesson durations for multi-subject sessions)
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
WHERE ls.id = st.session_id;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS get_subject_base_duration(tutoring_subject);

-- Add comment documenting the fix
COMMENT ON TABLE public.scheduled_lessons IS
  'Scheduled tutoring lessons. For combined sessions with multiple subjects, each lesson''s duration_min reflects the subject''s configured base duration (e.g., Piano=30min, Reading=60min).';
