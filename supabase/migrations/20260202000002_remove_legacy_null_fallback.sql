-- Migration: Remove legacy NULL fallback from RLS policies
-- Version: 20260202000002
-- Description: Removes the (is_tutor() AND tutor_id IS NULL) clause that causes data leakage
--
-- Prerequisites:
-- - Migration 20260202000001 has fixed all NULL tutor_id values
--
-- This migration:
-- 1. Removes NULL fallback from all RLS policies to prevent data leakage
-- 2. Removes inter-tutor visibility from parents table
-- 3. Ensures proper data isolation between tutors

-- ============================================================================
-- STUDENTS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Users can view students" ON students;
DROP POLICY IF EXISTS "Users can create students" ON students;
DROP POLICY IF EXISTS "Users can update students" ON students;
DROP POLICY IF EXISTS "Users can delete students" ON students;

-- Tutors can view students belonging to their business
-- Parents can view their own students
CREATE POLICY "Users can view students"
ON students
FOR SELECT
TO authenticated
USING (
    -- Tutors: see students where tutor_id matches their parent.id
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    -- Parents: see their own students
    (NOT is_tutor() AND parent_id = get_parent_id())
    OR
    -- Open enrollment sessions
    student_in_open_enrollment_session(id)
);

-- Tutors can create students for their business
-- Allow tutor_id to be NULL on insert (trigger will set it)
CREATE POLICY "Users can create students"
ON students
FOR INSERT
TO authenticated
WITH CHECK (
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors can update students in their business
CREATE POLICY "Users can update students"
ON students
FOR UPDATE
TO authenticated
USING (
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors can delete students in their business
CREATE POLICY "Users can delete students"
ON students
FOR DELETE
TO authenticated
USING (
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- ============================================================================
-- PARENTS TABLE - Remove NULL fallback and inter-tutor visibility
-- ============================================================================

DROP POLICY IF EXISTS "Users can view parent profiles" ON parents;
DROP POLICY IF EXISTS "Users can update parent profiles" ON parents;

-- Users can view their own profile
-- Tutors can view parents linked to them (but NOT other tutors)
CREATE POLICY "Users can view parent profiles"
ON parents
FOR SELECT
TO authenticated
USING (
    -- Own profile
    user_id = auth.uid()
    OR
    -- Tutors: see parents linked to them
    (is_tutor() AND tutor_id = get_current_tutor_id())
    -- REMOVED: (is_tutor() AND role = 'tutor') - tutors should NOT see other tutors
    -- REMOVED: (is_tutor() AND tutor_id IS NULL AND role = 'parent') - legacy fallback
);

-- Users can update their own profile
-- Tutors can update parents linked to them
CREATE POLICY "Users can update parent profiles"
ON parents
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    OR
    (is_tutor() AND tutor_id = get_current_tutor_id())
);

-- ============================================================================
-- SCHEDULED_LESSONS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Users can view scheduled lessons" ON scheduled_lessons;
DROP POLICY IF EXISTS "Tutors can manage scheduled lessons" ON scheduled_lessons;

-- Tutors can view lessons in their business
-- Parents can view lessons for their students
CREATE POLICY "Users can view scheduled lessons"
ON scheduled_lessons
FOR SELECT
TO authenticated
USING (
    -- Tutors: see lessons in their business
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    -- Parents: see their students' lessons
    (NOT is_tutor() AND student_id IN (
        SELECT id FROM students WHERE parent_id = get_parent_id()
    ))
    OR
    -- Open enrollment sessions
    lesson_in_open_enrollment_session(session_id)
);

-- Tutors have full CRUD on lessons in their business
-- Allow tutor_id to be NULL on insert (trigger will set it)
CREATE POLICY "Tutors can manage scheduled lessons"
ON scheduled_lessons
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- PAYMENTS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Tutors can manage payments" ON payments;

-- Tutors can view payments in their business
-- Parents can view their own payments
CREATE POLICY "Users can view payments"
ON payments
FOR SELECT
TO authenticated
USING (
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors have full CRUD on payments in their business
CREATE POLICY "Tutors can manage payments"
ON payments
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- MESSAGE_THREADS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage threads" ON message_threads;

-- Tutors can view/manage threads in their business
CREATE POLICY "Tutors can manage threads"
ON message_threads
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- MESSAGES TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage messages" ON messages;

-- Tutors can manage messages in their business threads
CREATE POLICY "Tutors can manage messages"
ON messages
FOR ALL
TO authenticated
USING (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.id = messages.thread_id
          AND mt.tutor_id = get_current_tutor_id()
    )
)
WITH CHECK (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.id = messages.thread_id
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
    )
);

-- ============================================================================
-- NOTIFICATIONS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can view all notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can create notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can update notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Parents can view their notifications" ON notifications;

-- Tutors can view notifications in their business
CREATE POLICY "Tutors can view all notifications"
ON notifications
FOR SELECT
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- Parents can view notifications sent to them
CREATE POLICY "Parents can view their notifications"
ON notifications
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND (
        recipient_id = get_parent_id()
        OR
        (recipient_id IS NULL AND tutor_id = get_current_tutor_id())
    )
);

-- Tutors can create notifications in their business
CREATE POLICY "Tutors can create notifications"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Tutors can update notifications in their business
CREATE POLICY "Tutors can update notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- Tutors can delete notifications in their business
CREATE POLICY "Tutors can delete notifications"
ON notifications
FOR DELETE
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- ============================================================================
-- PARENT_GROUPS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage groups" ON parent_groups;

-- Tutors can fully manage groups in their business
CREATE POLICY "Tutors can manage groups"
ON parent_groups
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- PARENT_GROUP_MEMBERS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage group members" ON parent_group_members;

-- Tutors can manage all memberships in their groups
CREATE POLICY "Tutors can manage group members"
ON parent_group_members
FOR ALL
TO authenticated
USING (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM parent_groups pg
        WHERE pg.id = parent_group_members.group_id
          AND pg.tutor_id = get_current_tutor_id()
    )
)
WITH CHECK (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM parent_groups pg
        WHERE pg.id = parent_group_members.group_id
          AND (pg.tutor_id = get_current_tutor_id() OR pg.tutor_id IS NULL)
    )
);

-- ============================================================================
-- ASSIGNMENTS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Users can view assignments" ON assignments;
DROP POLICY IF EXISTS "Tutors can manage assignments" ON assignments;

-- Tutors can view assignments in their business
-- Parents can view assignments for their students
CREATE POLICY "Users can view assignments"
ON assignments
FOR SELECT
TO authenticated
USING (
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    (NOT is_tutor() AND student_id IN (
        SELECT id FROM students WHERE parent_id = get_parent_id()
    ))
);

-- Tutors have full CRUD on assignments in their business
CREATE POLICY "Tutors can manage assignments"
ON assignments
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- MESSAGE_THREAD_PARTICIPANTS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage participants" ON message_thread_participants;

-- Tutors can manage participants in their threads
CREATE POLICY "Tutors can manage participants"
ON message_thread_participants
FOR ALL
TO authenticated
USING (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.id = message_thread_participants.thread_id
          AND mt.tutor_id = get_current_tutor_id()
    )
)
WITH CHECK (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.id = message_thread_participants.thread_id
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
    )
);

-- ============================================================================
-- MESSAGE_REACTIONS TABLE - Remove NULL fallback
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can manage reactions" ON message_reactions;

-- Tutors can manage reactions in their threads
CREATE POLICY "Tutors can manage reactions"
ON message_reactions
FOR ALL
TO authenticated
USING (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM messages m
        JOIN message_threads mt ON mt.id = m.thread_id
        WHERE m.id = message_reactions.message_id
          AND mt.tutor_id = get_current_tutor_id()
    )
)
WITH CHECK (
    is_tutor() AND
    EXISTS (
        SELECT 1 FROM messages m
        JOIN message_threads mt ON mt.id = m.thread_id
        WHERE m.id = message_reactions.message_id
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
    )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view students" ON students IS 'Tutors see their students only; parents see their own students; no NULL fallback';
COMMENT ON POLICY "Users can view parent profiles" ON parents IS 'Users see own profile; tutors see their parents only; no inter-tutor visibility';
COMMENT ON POLICY "Users can view scheduled lessons" ON scheduled_lessons IS 'Tutors see their lessons only; no NULL fallback';
COMMENT ON POLICY "Users can view payments" ON payments IS 'Tutors see their payments only; no NULL fallback';
COMMENT ON POLICY "Tutors can manage threads" ON message_threads IS 'Tutors see their threads only; no NULL fallback';
COMMENT ON POLICY "Tutors can view all notifications" ON notifications IS 'Tutors see their notifications only; no NULL fallback';
COMMENT ON POLICY "Tutors can manage groups" ON parent_groups IS 'Tutors see their groups only; no NULL fallback';
COMMENT ON POLICY "Users can view assignments" ON assignments IS 'Tutors see their assignments only; no NULL fallback';
