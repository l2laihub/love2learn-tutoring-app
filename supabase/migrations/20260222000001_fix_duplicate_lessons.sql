-- Fix Duplicate Lessons Migration
-- 1. Delete duplicate standalone lessons (keep oldest by created_at)
-- 2. Delete duplicate session-based lessons (same student/subject/time across different sessions)
-- 3. Clean up orphaned lesson_sessions
-- 4. Add unique indexes to prevent future duplicates

BEGIN;

-- Step 1: Delete duplicate standalone lessons (no session_id), keeping the oldest (min created_at)
DELETE FROM scheduled_lessons
WHERE id IN (
  SELECT sl.id
  FROM scheduled_lessons sl
  INNER JOIN (
    SELECT student_id, subject, scheduled_at, MIN(created_at) AS keep_created_at
    FROM scheduled_lessons
    WHERE session_id IS NULL
      AND status = 'scheduled'
    GROUP BY student_id, subject, scheduled_at
    HAVING COUNT(*) > 1
  ) dupes ON sl.student_id = dupes.student_id
         AND sl.subject = dupes.subject
         AND sl.scheduled_at = dupes.scheduled_at
         AND sl.session_id IS NULL
         AND sl.status = 'scheduled'
         AND sl.created_at != dupes.keep_created_at
);

-- Step 2: Delete duplicate session-based lessons (different session_ids, same student/subject/time)
-- Keep the lesson from the oldest session (by created_at)
DELETE FROM scheduled_lessons
WHERE id IN (
  SELECT sl.id
  FROM scheduled_lessons sl
  INNER JOIN (
    SELECT student_id, subject, scheduled_at, MIN(created_at) AS keep_created_at
    FROM scheduled_lessons
    WHERE session_id IS NOT NULL
      AND status = 'scheduled'
    GROUP BY student_id, subject, scheduled_at
    HAVING COUNT(DISTINCT session_id) > 1
  ) dupes ON sl.student_id = dupes.student_id
         AND sl.subject = dupes.subject
         AND sl.scheduled_at = dupes.scheduled_at
         AND sl.session_id IS NOT NULL
         AND sl.status = 'scheduled'
         AND sl.created_at != dupes.keep_created_at
);

-- Step 3: Clean up orphaned lesson_sessions (sessions with no remaining lessons)
DELETE FROM lesson_sessions
WHERE id NOT IN (
  SELECT DISTINCT session_id
  FROM scheduled_lessons
  WHERE session_id IS NOT NULL
);

-- Step 4: Add partial unique indexes to prevent future duplicates
-- For standalone lessons (no session_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_standalone_lesson
  ON scheduled_lessons (student_id, subject, scheduled_at)
  WHERE session_id IS NULL AND status = 'scheduled';

-- For session-based lessons (prevent same student+subject in same session)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_session_lesson
  ON scheduled_lessons (session_id, student_id, subject)
  WHERE session_id IS NOT NULL AND status = 'scheduled';

COMMIT;
