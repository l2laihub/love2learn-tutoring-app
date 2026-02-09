-- Migration: Fix open enrollment functions causing cross-tutor data leakage
-- Version: 20260202000003
-- Description: The open enrollment functions allow any authenticated user to see
--              students/lessons in open enrollment sessions. This should only
--              allow parents to see open enrollment data, not other tutors.

-- ============================================================================
-- FIX student_in_open_enrollment_session function
-- ============================================================================
-- The issue: This function returns true for ANY student in an open enrollment session,
-- allowing all tutors to see those students. It should:
-- - Allow parents to see students in open enrollment sessions (so they can join)
-- - NOT allow tutors to see other tutors' students

CREATE OR REPLACE FUNCTION student_in_open_enrollment_session(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
   RETURN EXISTS (
     SELECT 1
     FROM scheduled_lessons sl
     JOIN group_session_settings gss ON gss.session_id = sl.session_id
     WHERE sl.student_id = p_student_id
       AND sl.status != 'cancelled'
       AND gss.is_open_for_enrollment = true
       AND (
         -- Parents can see open enrollment students (for joining)
         NOT is_tutor()
         OR
         -- Tutors can only see their own open enrollment students
         sl.tutor_id = get_current_tutor_id()
       )
   );
END;
$$;

COMMENT ON FUNCTION student_in_open_enrollment_session(UUID) IS 'Check if student is in an open enrollment session. Parents can see any open enrollment student. Tutors can only see their own.';

-- ============================================================================
-- FIX lesson_in_open_enrollment_session function
-- ============================================================================
-- Same issue: allows any tutor to see any open enrollment lesson

CREATE OR REPLACE FUNCTION lesson_in_open_enrollment_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
   RETURN EXISTS (
     SELECT 1
     FROM group_session_settings gss
     JOIN scheduled_lessons sl ON sl.session_id = gss.session_id
     WHERE gss.session_id = p_session_id
       AND gss.is_open_for_enrollment = true
       AND (
         -- Parents can see open enrollment lessons (for joining)
         NOT is_tutor()
         OR
         -- Tutors can only see their own open enrollment lessons
         sl.tutor_id = get_current_tutor_id()
       )
   );
END;
$$;

COMMENT ON FUNCTION lesson_in_open_enrollment_session(UUID) IS 'Check if lesson session is open for enrollment. Parents can see any open enrollment lesson. Tutors can only see their own.';

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION student_in_open_enrollment_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION lesson_in_open_enrollment_session(UUID) TO authenticated;
