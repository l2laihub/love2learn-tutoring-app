-- Fix group lesson durations
--
-- Previous logic incorrectly divided session duration among students for ALL combined sessions.
-- This was correct for SEQUENTIAL lessons (different subjects - e.g., Piano then Speech),
-- but WRONG for GROUP lessons (same subject - e.g., Math group class).
--
-- Group lessons: Multiple students learning the SAME subject together
--   - Each student should get the FULL session duration
--   - E.g., 60min Math group lesson with 2 students → each gets 60min
--
-- Sequential lessons: Multiple students with DIFFERENT subjects
--   - Time is divided (tutor teaches one then the other)
--   - E.g., 60min session with Piano + Speech → 30min each

-- Step 1: Identify group lesson sessions (all lessons in session have same subject)
CREATE TEMP TABLE group_lesson_sessions AS
SELECT
  sl.session_id,
  ls.duration_min as session_duration,
  COUNT(*) as lesson_count,
  COUNT(DISTINCT sl.subject) as subject_count
FROM public.scheduled_lessons sl
JOIN public.lesson_sessions ls ON ls.id = sl.session_id
WHERE sl.session_id IS NOT NULL
GROUP BY sl.session_id, ls.duration_min
HAVING COUNT(DISTINCT sl.subject) = 1  -- All lessons have the same subject
   AND COUNT(*) > 1;                     -- Multiple students in the session

-- Step 2: Update group lesson durations to full session duration
-- Only update lessons that have incorrect (split) duration
UPDATE public.scheduled_lessons sl
SET duration_min = gls.session_duration
FROM group_lesson_sessions gls
WHERE sl.session_id = gls.session_id
  AND sl.duration_min != gls.session_duration  -- Only fix incorrect durations
  AND sl.duration_min = gls.session_duration / gls.lesson_count;  -- Verify it's the split amount

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % group lesson records to have full session duration', updated_count;
END $$;

-- Clean up
DROP TABLE IF EXISTS group_lesson_sessions;
