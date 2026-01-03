-- Migration: Role System for Tutor/Parent Access Control
-- Version: 20260102000002
-- Description: Adds role column to parents table and updates RLS policies for tutor access

-- ============================================================================
-- ADD ROLE COLUMN TO PARENTS TABLE
-- ============================================================================

-- Add role column with default 'parent'
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'parent'
CHECK (role IN ('parent', 'tutor'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_parents_role ON parents(role);

-- ============================================================================
-- HELPER FUNCTION: Check if current user is a tutor
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM parents
        WHERE user_id = auth.uid()
        AND role = 'tutor'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE PARENTS POLICIES
-- ============================================================================

-- Drop existing policies to recreate with tutor access
DROP POLICY IF EXISTS "Users can view own parent profile" ON parents;
DROP POLICY IF EXISTS "Users can update own parent profile" ON parents;

-- Tutors can view all parents, regular users can only view their own
CREATE POLICY "Users can view parent profiles"
    ON parents FOR SELECT
    USING (
        auth.uid() = user_id
        OR public.is_tutor()
    );

-- Tutors can update all parents, regular users can only update their own
CREATE POLICY "Users can update parent profiles"
    ON parents FOR UPDATE
    USING (
        auth.uid() = user_id
        OR public.is_tutor()
    );

-- ============================================================================
-- UPDATE STUDENTS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Parents can view own students" ON students;
DROP POLICY IF EXISTS "Parents can create own students" ON students;
DROP POLICY IF EXISTS "Parents can update own students" ON students;
DROP POLICY IF EXISTS "Parents can delete own students" ON students;

-- Tutors can view all students, parents can only view their own
CREATE POLICY "Users can view students"
    ON students FOR SELECT
    USING (
        parent_id = public.get_parent_id()
        OR public.is_tutor()
    );

-- Tutors can create students for any parent, parents can only create for themselves
CREATE POLICY "Users can create students"
    ON students FOR INSERT
    WITH CHECK (
        parent_id = public.get_parent_id()
        OR public.is_tutor()
    );

-- Tutors can update any student, parents can only update their own
CREATE POLICY "Users can update students"
    ON students FOR UPDATE
    USING (
        parent_id = public.get_parent_id()
        OR public.is_tutor()
    );

-- Tutors can delete any student, parents can only delete their own
CREATE POLICY "Users can delete students"
    ON students FOR DELETE
    USING (
        parent_id = public.get_parent_id()
        OR public.is_tutor()
    );

-- ============================================================================
-- UPDATE STUDENT PROGRESS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view student progress" ON student_progress;
DROP POLICY IF EXISTS "Parents can manage student progress" ON student_progress;

CREATE POLICY "Users can view student progress"
    ON student_progress FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

CREATE POLICY "Users can manage student progress"
    ON student_progress FOR ALL
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

-- ============================================================================
-- UPDATE STUDENT ACHIEVEMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view student achievements" ON student_achievements;

CREATE POLICY "Users can view student achievements"
    ON student_achievements FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

-- Tutors can also grant achievements (not just service role)
DROP POLICY IF EXISTS "Service role can grant achievements" ON student_achievements;

CREATE POLICY "Tutors can grant achievements"
    ON student_achievements FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR public.is_tutor()
    );

-- ============================================================================
-- UPDATE CHAT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view student chats" ON chat_sessions;
DROP POLICY IF EXISTS "Parents can create student chats" ON chat_sessions;

CREATE POLICY "Users can view chat sessions"
    ON chat_sessions FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

CREATE POLICY "Users can create chat sessions"
    ON chat_sessions FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

DROP POLICY IF EXISTS "Parents can view chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Parents can create chat messages" ON chat_messages;

CREATE POLICY "Users can view chat messages"
    ON chat_messages FOR SELECT
    USING (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN students s ON cs.student_id = s.id
            WHERE s.parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

CREATE POLICY "Users can create chat messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN students s ON cs.student_id = s.id
            WHERE s.parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

-- ============================================================================
-- UPDATE SCHEDULED LESSONS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view scheduled lessons" ON scheduled_lessons;
DROP POLICY IF EXISTS "Parents can manage scheduled lessons" ON scheduled_lessons;

CREATE POLICY "Users can view scheduled lessons"
    ON scheduled_lessons FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

-- Only tutors can fully manage scheduled lessons (CRUD)
-- Parents can only view their students' lessons
CREATE POLICY "Tutors can manage scheduled lessons"
    ON scheduled_lessons FOR ALL
    USING (public.is_tutor());

-- ============================================================================
-- UPDATE PAYMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view own payments" ON payments;
DROP POLICY IF EXISTS "Parents can manage own payments" ON payments;

-- Parents can view their own payments, tutors can view all
CREATE POLICY "Users can view payments"
    ON payments FOR SELECT
    USING (
        parent_id = public.get_parent_id()
        OR public.is_tutor()
    );

-- Only tutors can manage payments (create, update, delete)
CREATE POLICY "Tutors can manage payments"
    ON payments FOR ALL
    USING (public.is_tutor());

-- ============================================================================
-- UPDATE ASSIGNMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Parents can view assignments" ON assignments;
DROP POLICY IF EXISTS "Parents can manage assignments" ON assignments;

-- Parents can view their students' assignments, tutors can view all
CREATE POLICY "Users can view assignments"
    ON assignments FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
        OR public.is_tutor()
    );

-- Only tutors can manage assignments (create, update, delete)
CREATE POLICY "Tutors can manage assignments"
    ON assignments FOR ALL
    USING (public.is_tutor());

-- ============================================================================
-- COMMENT: To make a user a tutor, run:
-- UPDATE parents SET role = 'tutor' WHERE email = 'tutor@example.com';
-- ============================================================================
