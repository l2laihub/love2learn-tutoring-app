-- Migration: Fix RLS for Group Session Enrollment
-- Version: 20260122000001
-- Description: Allows parents to view lesson_sessions and scheduled_lessons
--              that are open for enrollment, even if their children aren't enrolled yet.

-- ============================================================================
-- UPDATE LESSON_SESSIONS RLS POLICY
-- ============================================================================

-- Drop the existing restrictive policy for parents
DROP POLICY IF EXISTS "Parents can view their children's lesson sessions" ON public.lesson_sessions;

-- Create new policy that allows parents to see:
-- 1. Sessions that contain their children's lessons (existing behavior)
-- 2. Sessions that are open for enrollment (new behavior for group enrollment)
CREATE POLICY "Parents can view accessible lesson sessions"
ON public.lesson_sessions
FOR SELECT
TO authenticated
USING (
    -- Condition 1: Sessions with their children's lessons
    EXISTS (
        SELECT 1 FROM public.scheduled_lessons sl
        JOIN public.students s ON sl.student_id = s.id
        WHERE sl.session_id = lesson_sessions.id
        AND s.parent_id = public.get_parent_id()
    )
    OR
    -- Condition 2: Sessions open for enrollment
    EXISTS (
        SELECT 1 FROM public.group_session_settings gss
        WHERE gss.session_id = lesson_sessions.id
        AND gss.is_open_for_enrollment = true
    )
    OR
    -- Condition 3: Tutors can see all
    public.is_tutor()
);

-- ============================================================================
-- UPDATE SCHEDULED_LESSONS RLS POLICY
-- ============================================================================

-- Drop existing parent view policy
DROP POLICY IF EXISTS "Users can view scheduled lessons" ON public.scheduled_lessons;

-- Create new policy that allows parents to see:
-- 1. Their own children's lessons (existing behavior)
-- 2. Lessons in sessions open for enrollment (to count students/slots)
CREATE POLICY "Users can view scheduled lessons"
ON public.scheduled_lessons
FOR SELECT
TO authenticated
USING (
    -- Condition 1: Own children's lessons
    student_id IN (
        SELECT id FROM public.students WHERE parent_id = public.get_parent_id()
    )
    OR
    -- Condition 2: Lessons in sessions open for enrollment
    -- (allows parents to see slot counts)
    session_id IN (
        SELECT gss.session_id FROM public.group_session_settings gss
        WHERE gss.is_open_for_enrollment = true
    )
    OR
    -- Condition 3: Tutors can see all
    public.is_tutor()
);

-- ============================================================================
-- UPDATE STUDENTS RLS POLICY
-- ============================================================================

-- Drop existing view policy
DROP POLICY IF EXISTS "Users can view students" ON public.students;

-- Create new policy that allows parents to see:
-- 1. Their own children (existing behavior)
-- 2. Students in sessions open for enrollment (to see who else is enrolled)
CREATE POLICY "Users can view students"
ON public.students
FOR SELECT
TO authenticated
USING (
    -- Condition 1: Own children
    parent_id = public.get_parent_id()
    OR
    -- Condition 2: Students in sessions open for enrollment
    -- (allows parents to see who else is in a group session)
    id IN (
        SELECT sl.student_id FROM public.scheduled_lessons sl
        WHERE sl.session_id IN (
            SELECT gss.session_id FROM public.group_session_settings gss
            WHERE gss.is_open_for_enrollment = true
        )
        AND sl.status != 'cancelled'
    )
    OR
    -- Condition 3: Tutors can see all
    public.is_tutor()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After running this migration, verify parents can see open sessions:
-- SELECT ls.* FROM lesson_sessions ls
-- JOIN group_session_settings gss ON gss.session_id = ls.id
-- WHERE gss.is_open_for_enrollment = true;
