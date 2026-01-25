-- Migration: Fix RLS Recursion for Group Session Enrollment
-- Version: 20260122000002
-- Description: Fixes infinite recursion in RLS policies by using SECURITY DEFINER functions

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER - bypass RLS)
-- ============================================================================

-- Function to check if a student is in an open enrollment session
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.student_in_open_enrollment_session(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM scheduled_lessons sl
    JOIN group_session_settings gss ON gss.session_id = sl.session_id
    WHERE sl.student_id = p_student_id
      AND sl.status != 'cancelled'
      AND gss.is_open_for_enrollment = true
  );
$$;

-- Function to check if a lesson is in an open enrollment session
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION public.lesson_in_open_enrollment_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_session_settings gss
    WHERE gss.session_id = p_session_id
      AND gss.is_open_for_enrollment = true
  );
$$;

-- ============================================================================
-- FIX STUDENTS RLS POLICY
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view students" ON public.students;

-- Create fixed policy using SECURITY DEFINER function
CREATE POLICY "Users can view students"
ON public.students
FOR SELECT
TO authenticated
USING (
    -- Condition 1: Own children
    parent_id = public.get_parent_id()
    OR
    -- Condition 2: Students in sessions open for enrollment (uses SECURITY DEFINER function)
    public.student_in_open_enrollment_session(id)
    OR
    -- Condition 3: Tutors can see all
    public.is_tutor()
);

-- ============================================================================
-- FIX SCHEDULED_LESSONS RLS POLICY
-- ============================================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view scheduled lessons" ON public.scheduled_lessons;

-- Create fixed policy using SECURITY DEFINER function
CREATE POLICY "Users can view scheduled lessons"
ON public.scheduled_lessons
FOR SELECT
TO authenticated
USING (
    -- Condition 1: Own children's lessons (uses get_parent_id which doesn't cause recursion)
    student_id IN (
        SELECT id FROM public.students WHERE parent_id = public.get_parent_id()
    )
    OR
    -- Condition 2: Lessons in sessions open for enrollment (uses SECURITY DEFINER function)
    public.lesson_in_open_enrollment_session(session_id)
    OR
    -- Condition 3: Tutors can see all
    public.is_tutor()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test the functions work correctly:
-- SELECT public.student_in_open_enrollment_session('some-student-uuid');
-- SELECT public.lesson_in_open_enrollment_session('some-session-uuid');
