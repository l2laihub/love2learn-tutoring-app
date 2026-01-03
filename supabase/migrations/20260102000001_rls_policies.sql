-- Migration: Row Level Security Policies
-- Version: 20260102000001
-- Description: Enables RLS and creates security policies for all tables

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS (in public schema)
-- ============================================================================

-- Helper function to get current user's parent ID
CREATE OR REPLACE FUNCTION public.get_parent_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM parents WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARENTS POLICIES
-- ============================================================================

-- Users can view their own parent profile
CREATE POLICY "Users can view own parent profile"
    ON parents FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own parent profile
CREATE POLICY "Users can update own parent profile"
    ON parents FOR UPDATE
    USING (auth.uid() = user_id);

-- Authenticated users can create their own parent profile
CREATE POLICY "Authenticated users can create parent profile"
    ON parents FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );

-- ============================================================================
-- STUDENTS POLICIES
-- ============================================================================

-- Parents can view their own students
CREATE POLICY "Parents can view own students"
    ON students FOR SELECT
    USING (parent_id = public.get_parent_id());

-- Parents can create students linked to themselves
CREATE POLICY "Parents can create own students"
    ON students FOR INSERT
    WITH CHECK (parent_id = public.get_parent_id());

-- Parents can update their own students
CREATE POLICY "Parents can update own students"
    ON students FOR UPDATE
    USING (parent_id = public.get_parent_id());

-- Parents can delete their own students
CREATE POLICY "Parents can delete own students"
    ON students FOR DELETE
    USING (parent_id = public.get_parent_id());

-- ============================================================================
-- SUBJECTS POLICIES (Public read, admin write)
-- ============================================================================

CREATE POLICY "Anyone can view subjects"
    ON subjects FOR SELECT
    USING (true);

CREATE POLICY "Only service role can modify subjects"
    ON subjects FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- LESSONS POLICIES (Public read, admin write)
-- ============================================================================

CREATE POLICY "Anyone can view lessons"
    ON lessons FOR SELECT
    USING (true);

CREATE POLICY "Only service role can modify lessons"
    ON lessons FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- STUDENT PROGRESS POLICIES
-- ============================================================================

-- Parents can view progress for their students
CREATE POLICY "Parents can view student progress"
    ON student_progress FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- Parents can manage progress for their students
CREATE POLICY "Parents can manage student progress"
    ON student_progress FOR ALL
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- ============================================================================
-- ACHIEVEMENTS POLICIES (Public read)
-- ============================================================================

CREATE POLICY "Anyone can view achievements"
    ON achievements FOR SELECT
    USING (true);

CREATE POLICY "Only service role can modify achievements"
    ON achievements FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- STUDENT ACHIEVEMENTS POLICIES
-- ============================================================================

CREATE POLICY "Parents can view student achievements"
    ON student_achievements FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

CREATE POLICY "Service role can grant achievements"
    ON student_achievements FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- CHAT POLICIES
-- ============================================================================

-- Parents can view their students' chat sessions
CREATE POLICY "Parents can view student chats"
    ON chat_sessions FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- Parents can create chat sessions for their students
CREATE POLICY "Parents can create student chats"
    ON chat_sessions FOR INSERT
    WITH CHECK (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- Parents can view messages in their students' chats
CREATE POLICY "Parents can view chat messages"
    ON chat_messages FOR SELECT
    USING (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN students s ON cs.student_id = s.id
            WHERE s.parent_id = public.get_parent_id()
        )
    );

-- Parents can create messages in their students' chats
CREATE POLICY "Parents can create chat messages"
    ON chat_messages FOR INSERT
    WITH CHECK (
        session_id IN (
            SELECT cs.id FROM chat_sessions cs
            JOIN students s ON cs.student_id = s.id
            WHERE s.parent_id = public.get_parent_id()
        )
    );

-- ============================================================================
-- SCHEDULED LESSONS POLICIES
-- ============================================================================

-- Parents can view their students' scheduled lessons
CREATE POLICY "Parents can view scheduled lessons"
    ON scheduled_lessons FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- Parents can manage their students' scheduled lessons
CREATE POLICY "Parents can manage scheduled lessons"
    ON scheduled_lessons FOR ALL
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- ============================================================================
-- PAYMENTS POLICIES
-- ============================================================================

-- Parents can view their own payments
CREATE POLICY "Parents can view own payments"
    ON payments FOR SELECT
    USING (parent_id = public.get_parent_id());

-- Parents can manage their own payments
CREATE POLICY "Parents can manage own payments"
    ON payments FOR ALL
    USING (parent_id = public.get_parent_id());

-- ============================================================================
-- ASSIGNMENTS POLICIES
-- ============================================================================

-- Parents can view their students' assignments
CREATE POLICY "Parents can view assignments"
    ON assignments FOR SELECT
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );

-- Parents can manage their students' assignments
CREATE POLICY "Parents can manage assignments"
    ON assignments FOR ALL
    USING (
        student_id IN (
            SELECT id FROM students WHERE parent_id = public.get_parent_id()
        )
    );
