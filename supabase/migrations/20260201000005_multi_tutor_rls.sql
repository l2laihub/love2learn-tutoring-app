-- Migration: Multi-tutor RLS policies for data isolation
-- Version: 20260201000005
-- Description: Updates RLS policies to isolate data by tutor_id for multi-tutor support
--
-- Prerequisites:
-- - Migration 20260201000002_tutor_id_columns.sql has added tutor_id columns
-- - Migration 20260201000003_backfill_tutor_id.sql has populated tutor_id values
-- - Function get_current_tutor_id() exists and returns the tutor's ID
--
-- This migration:
-- 1. Drops old policies that don't account for tutor_id
-- 2. Creates new policies with tutor_id filtering for data isolation
-- 3. Ensures tutors can only see/manage data belonging to their business
-- 4. Ensures parents can only see data from their associated tutor

-- ============================================================================
-- HELPER FUNCTION: Check if user is in same tutor context
-- ============================================================================

-- Function to check if a tutor_id matches the current user's tutor context
-- This is used to avoid recursion in RLS policies
CREATE OR REPLACE FUNCTION public.matches_current_tutor(p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_tutor_id IS NOT NULL AND p_tutor_id = get_current_tutor_id();
$$;

COMMENT ON FUNCTION public.matches_current_tutor(UUID) IS 'Checks if given tutor_id matches current user tutor context. Returns false if tutor_id is NULL.';

GRANT EXECUTE ON FUNCTION public.matches_current_tutor(UUID) TO authenticated;

-- ============================================================================
-- STUDENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view students" ON students;
DROP POLICY IF EXISTS "Users can create students" ON students;
DROP POLICY IF EXISTS "Users can update students" ON students;
DROP POLICY IF EXISTS "Users can delete students" ON students;

-- Tutors can view students belonging to their business
-- Parents can view their own students (within their tutor's context)
CREATE POLICY "Users can view students"
ON students
FOR SELECT
TO authenticated
USING (
    -- Tutors: see students where tutor_id matches their parent.id
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    -- Parents: see their own students (parent_id check ensures tutor_id also matches)
    (NOT is_tutor() AND parent_id = get_parent_id())
    OR
    -- Legacy: students without tutor_id (temporary for migration)
    (is_tutor() AND tutor_id IS NULL)
);

-- Tutors can create students for their business
CREATE POLICY "Users can create students"
ON students
FOR INSERT
TO authenticated
WITH CHECK (
    -- Tutors can create students with their tutor_id
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    -- Parents can create students for themselves (tutor_id auto-set via trigger)
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors can update students in their business
-- Parents can update their own students
CREATE POLICY "Users can update students"
ON students
FOR UPDATE
TO authenticated
USING (
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors can delete students in their business
CREATE POLICY "Users can delete students"
ON students
FOR DELETE
TO authenticated
USING (
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- ============================================================================
-- PARENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view parent profiles" ON parents;
DROP POLICY IF EXISTS "Users can update parent profiles" ON parents;

-- Tutors can view parents linked to them (tutor_id = their parent.id) or their own profile
-- Parents can only view their own profile
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
    OR
    -- Tutors: see other tutors (for future multi-tutor teams)
    (is_tutor() AND role = 'tutor')
    OR
    -- Legacy: parents without tutor_id (temporary for migration)
    (is_tutor() AND tutor_id IS NULL AND role = 'parent')
);

-- Tutors can update parents linked to them
-- Parents can only update their own profile
CREATE POLICY "Users can update parent profiles"
ON parents
FOR UPDATE
TO authenticated
USING (
    -- Own profile
    user_id = auth.uid()
    OR
    -- Tutors: update parents linked to them
    (is_tutor() AND tutor_id = get_current_tutor_id())
    OR
    -- Legacy: parents without tutor_id
    (is_tutor() AND tutor_id IS NULL AND role = 'parent')
);

-- ============================================================================
-- SCHEDULED_LESSONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
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
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    -- Parents: see their students' lessons
    (NOT is_tutor() AND student_id IN (
        SELECT id FROM students WHERE parent_id = get_parent_id()
    ))
    OR
    -- Open enrollment sessions (from fix_rls_recursion migration)
    lesson_in_open_enrollment_session(session_id)
);

-- Tutors have full CRUD on lessons in their business
CREATE POLICY "Tutors can manage scheduled lessons"
ON scheduled_lessons
FOR ALL
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Tutors can manage payments" ON payments;

-- Tutors can view payments in their business
-- Parents can view their own payments
CREATE POLICY "Users can view payments"
ON payments
FOR SELECT
TO authenticated
USING (
    -- Tutors: see payments in their business
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    -- Parents: see their own payments
    (NOT is_tutor() AND parent_id = get_parent_id())
);

-- Tutors have full CRUD on payments in their business
CREATE POLICY "Tutors can manage payments"
ON payments
FOR ALL
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- MESSAGE_THREADS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage threads" ON message_threads;
DROP POLICY IF EXISTS "Parents can view their threads" ON message_threads;

-- Tutors can view/manage threads in their business
CREATE POLICY "Tutors can manage threads"
ON message_threads
FOR ALL
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Parents can view threads they are participants in (within their tutor's context)
CREATE POLICY "Parents can view their threads"
ON message_threads
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_thread_participants
        WHERE thread_id = message_threads.id
          AND parent_id = get_parent_id()
    )
);

-- ============================================================================
-- MESSAGES TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage messages" ON messages;
DROP POLICY IF EXISTS "Parents can view thread messages" ON messages;
DROP POLICY IF EXISTS "Parents can send messages" ON messages;

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
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
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

-- Parents can view messages in threads they participate in
CREATE POLICY "Parents can view thread messages"
ON messages
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND
    EXISTS (
        SELECT 1 FROM message_thread_participants
        WHERE thread_id = messages.thread_id
          AND parent_id = get_parent_id()
    )
);

-- Parents can send messages to threads they participate in
CREATE POLICY "Parents can send messages"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
    NOT is_tutor() AND
    sender_id = get_parent_id() AND
    EXISTS (
        SELECT 1 FROM message_thread_participants
        WHERE thread_id = messages.thread_id
          AND parent_id = get_parent_id()
    )
);

-- ============================================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can view all notifications" ON notifications;
DROP POLICY IF EXISTS "Parents can view their notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can create notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can update notifications" ON notifications;
DROP POLICY IF EXISTS "Tutors can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Parents can mark notifications read" ON notifications;

-- Tutors can view notifications in their business
CREATE POLICY "Tutors can view all notifications"
ON notifications
FOR SELECT
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Parents can view notifications sent to them or announcements (within tutor context)
CREATE POLICY "Parents can view their notifications"
ON notifications
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND (
        -- Direct notifications to this parent
        recipient_id = get_parent_id()
        OR
        -- Announcements (recipient_id IS NULL) in their tutor's context
        (recipient_id IS NULL AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
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
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Tutors can delete notifications in their business
CREATE POLICY "Tutors can delete notifications"
ON notifications
FOR DELETE
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Parents can mark their own notifications as read
CREATE POLICY "Parents can mark notifications read"
ON notifications
FOR UPDATE
TO authenticated
USING (
    NOT is_tutor() AND recipient_id = get_parent_id()
)
WITH CHECK (
    NOT is_tutor() AND recipient_id = get_parent_id()
);

-- ============================================================================
-- PARENT_GROUPS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage groups" ON parent_groups;
DROP POLICY IF EXISTS "Parents can view their groups" ON parent_groups;

-- Tutors can fully manage groups in their business
CREATE POLICY "Tutors can manage groups"
ON parent_groups
FOR ALL
TO authenticated
USING (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- Parents can view groups they are members of (membership implies same tutor context)
CREATE POLICY "Parents can view their groups"
ON parent_groups
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND
    EXISTS (
        SELECT 1 FROM parent_group_members
        WHERE group_id = parent_groups.id
          AND parent_id = get_parent_id()
    )
);

-- ============================================================================
-- PARENT_GROUP_MEMBERS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage group members" ON parent_group_members;
DROP POLICY IF EXISTS "Parents can view own membership" ON parent_group_members;

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
          AND (pg.tutor_id = get_current_tutor_id() OR pg.tutor_id IS NULL)
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

-- Parents can view their own membership records
CREATE POLICY "Parents can view own membership"
ON parent_group_members
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- ============================================================================
-- ASSIGNMENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view assignments" ON assignments;
DROP POLICY IF EXISTS "Tutors can manage assignments" ON assignments;

-- Tutors can view assignments in their business
-- Parents can view assignments for their students
CREATE POLICY "Users can view assignments"
ON assignments
FOR SELECT
TO authenticated
USING (
    -- Tutors: see assignments in their business
    (is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL))
    OR
    -- Parents: see their students' assignments
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
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- SHARED_RESOURCES TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage all shared resources" ON shared_resources;
DROP POLICY IF EXISTS "Parents can view their shared resources" ON shared_resources;
DROP POLICY IF EXISTS "Parents can mark resources as viewed" ON shared_resources;

-- Tutors can manage shared resources in their business
CREATE POLICY "Tutors can manage all shared resources"
ON shared_resources
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- Parents can view resources shared with them
CREATE POLICY "Parents can view their shared resources"
ON shared_resources
FOR SELECT
TO authenticated
USING (
    is_visible_to_parent = true
    AND NOT is_tutor()
    AND parent_id = get_parent_id()
);

-- Parents can mark resources as viewed
CREATE POLICY "Parents can mark resources as viewed"
ON shared_resources
FOR UPDATE
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
)
WITH CHECK (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- ============================================================================
-- MESSAGE_THREAD_PARTICIPANTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage participants" ON message_thread_participants;
DROP POLICY IF EXISTS "Parents can view own participation" ON message_thread_participants;
DROP POLICY IF EXISTS "Parents can update their read status" ON message_thread_participants;

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
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
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

-- Parents can view their own participation records
CREATE POLICY "Parents can view own participation"
ON message_thread_participants
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- Parents can update their own last_read_at
CREATE POLICY "Parents can update their read status"
ON message_thread_participants
FOR UPDATE
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
)
WITH CHECK (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- ============================================================================
-- MESSAGE_REACTIONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can remove own reactions" ON message_reactions;

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
          AND (mt.tutor_id = get_current_tutor_id() OR mt.tutor_id IS NULL)
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

-- Parents can view reactions on messages in their threads
CREATE POLICY "Parents can view reactions"
ON message_reactions
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND
    EXISTS (
        SELECT 1 FROM messages m
        JOIN message_thread_participants mtp ON mtp.thread_id = m.thread_id
        WHERE m.id = message_reactions.message_id
          AND mtp.parent_id = get_parent_id()
    )
);

-- Parents can add reactions to messages in their threads
CREATE POLICY "Parents can add reactions"
ON message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    NOT is_tutor() AND
    parent_id = get_parent_id() AND
    EXISTS (
        SELECT 1 FROM messages m
        JOIN message_thread_participants mtp ON mtp.thread_id = m.thread_id
        WHERE m.id = message_reactions.message_id
          AND mtp.parent_id = get_parent_id()
    )
);

-- Parents can remove their own reactions
CREATE POLICY "Parents can remove own reactions"
ON message_reactions
FOR DELETE
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- ============================================================================
-- NOTIFICATION_READS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their read records" ON notification_reads;
DROP POLICY IF EXISTS "Users can create read records" ON notification_reads;

-- Users can view their own read records
-- Tutors can view read records for notifications in their business
CREATE POLICY "Users can view their read records"
ON notification_reads
FOR SELECT
TO authenticated
USING (
    parent_id = get_parent_id()
    OR
    (is_tutor() AND EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.id = notification_reads.notification_id
          AND (n.tutor_id = get_current_tutor_id() OR n.tutor_id IS NULL)
    ))
);

-- Users can create their own read records
CREATE POLICY "Users can create read records"
ON notification_reads
FOR INSERT
TO authenticated
WITH CHECK (
    parent_id = get_parent_id()
);

-- ============================================================================
-- TUTOR_SETTINGS TABLE POLICIES (VERIFICATION)
-- ============================================================================

-- The tutor_settings table already uses tutor_id = auth.uid()
-- which correctly scopes settings to the authenticated tutor.
-- No changes needed, but let's verify the policies exist correctly.

-- Drop and recreate to ensure correct behavior
DROP POLICY IF EXISTS "Tutors can manage their own settings" ON tutor_settings;
DROP POLICY IF EXISTS "Authenticated users can read tutor settings" ON tutor_settings;

-- Tutors can only manage their own settings
CREATE POLICY "Tutors can manage their own settings"
ON tutor_settings
FOR ALL
TO authenticated
USING (tutor_id = auth.uid())
WITH CHECK (tutor_id = auth.uid());

-- Authenticated users can read tutor settings for invoice calculations
-- Scoped to settings belonging to the user's tutor context
CREATE POLICY "Authenticated users can read tutor settings"
ON tutor_settings
FOR SELECT
TO authenticated
USING (
    -- Users can read settings for their tutor (either as tutor or as parent)
    tutor_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM parents p
        WHERE p.user_id = auth.uid()
          AND p.tutor_id = (
            SELECT p2.id FROM parents p2 WHERE p2.user_id = tutor_settings.tutor_id
          )
    )
);

-- ============================================================================
-- LESSON_SESSIONS TABLE POLICIES (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_sessions') THEN
        -- Drop existing policies
        EXECUTE 'DROP POLICY IF EXISTS "Tutors can manage lesson sessions" ON lesson_sessions';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view lesson sessions" ON lesson_sessions';

        -- Tutors can manage lesson sessions
        EXECUTE 'CREATE POLICY "Tutors can manage lesson sessions"
            ON lesson_sessions
            FOR ALL
            TO authenticated
            USING (is_tutor())
            WITH CHECK (is_tutor())';

        -- Users can view lesson sessions for lessons they can access
        EXECUTE 'CREATE POLICY "Users can view lesson sessions"
            ON lesson_sessions
            FOR SELECT
            TO authenticated
            USING (
                is_tutor()
                OR
                EXISTS (
                    SELECT 1 FROM scheduled_lessons sl
                    JOIN students s ON s.id = sl.student_id
                    WHERE sl.id = lesson_sessions.lesson_id
                      AND s.parent_id = get_parent_id()
                )
            )';
    END IF;
END $$;

-- ============================================================================
-- UPDATE SECURITY DEFINER FUNCTIONS TO USE TUTOR CONTEXT
-- ============================================================================

-- Update create_message_thread to set tutor_id
CREATE OR REPLACE FUNCTION create_message_thread(
  p_subject TEXT,
  p_content TEXT,
  p_sender_id UUID,
  p_recipient_type TEXT,
  p_group_id UUID DEFAULT NULL,
  p_images TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_parent_record RECORD;
  v_tutor_id UUID;
BEGIN
  -- Get the tutor_id for this thread
  SELECT get_current_tutor_id() INTO v_tutor_id;

  -- Validate recipient_type
  IF p_recipient_type NOT IN ('all', 'group', 'individual') THEN
    RAISE EXCEPTION 'Invalid recipient_type. Must be "all", "group", or "individual"';
  END IF;

  -- If group, validate group exists
  IF p_recipient_type = 'group' AND p_group_id IS NULL THEN
    RAISE EXCEPTION 'group_id is required when recipient_type is "group"';
  END IF;

  -- Create the thread with tutor_id
  INSERT INTO message_threads (subject, created_by, recipient_type, group_id, tutor_id)
  VALUES (p_subject, p_sender_id, p_recipient_type, p_group_id, v_tutor_id)
  RETURNING id INTO v_thread_id;

  -- Create the initial message
  INSERT INTO messages (thread_id, sender_id, content, images)
  VALUES (v_thread_id, p_sender_id, p_content, p_images);

  -- Add sender as participant (tutor)
  INSERT INTO message_thread_participants (thread_id, parent_id, last_read_at)
  VALUES (v_thread_id, p_sender_id, now());

  -- Add recipients as participants
  IF p_recipient_type = 'all' THEN
    -- Add all parents belonging to this tutor (except the sender)
    FOR v_parent_record IN
      SELECT id FROM parents
      WHERE role = 'parent'
        AND id != p_sender_id
        AND tutor_id = v_tutor_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.id);
    END LOOP;
  ELSIF p_recipient_type = 'group' THEN
    -- Add group members (except the sender)
    FOR v_parent_record IN
      SELECT parent_id FROM parent_group_members
      WHERE group_id = p_group_id AND parent_id != p_sender_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.parent_id);
    END LOOP;
  END IF;
  -- For 'individual' type, only sender is added; recipients added separately

  RETURN v_thread_id;
END;
$$;

-- Update create_notification to set tutor_id
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_sender_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_priority notification_priority DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
  v_tutor_id UUID;
BEGIN
  -- Get the tutor_id for this notification
  SELECT get_current_tutor_id() INTO v_tutor_id;

  INSERT INTO notifications (
    recipient_id,
    sender_id,
    type,
    title,
    message,
    data,
    priority,
    action_url,
    expires_at,
    tutor_id
  ) VALUES (
    p_recipient_id,
    p_sender_id,
    p_type,
    p_title,
    p_message,
    p_data,
    p_priority,
    p_action_url,
    p_expires_at,
    v_tutor_id
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Update send_announcement to set tutor_id
CREATE OR REPLACE FUNCTION send_announcement(
  p_sender_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_priority notification_priority DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN create_notification(
    NULL,
    p_sender_id,
    'announcement'::notification_type,
    p_title,
    p_message,
    '{}',
    p_priority,
    NULL,
    p_expires_at
  );
END;
$$;

-- Update get_unread_notification_count to respect tutor context
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_direct_count INTEGER;
  v_broadcast_count INTEGER;
  v_tutor_id UUID;
BEGIN
  -- Get the tutor context for this parent
  SELECT tutor_id INTO v_tutor_id FROM parents WHERE id = p_parent_id;

  -- If no tutor_id found, use get_current_tutor_id
  IF v_tutor_id IS NULL THEN
    v_tutor_id := get_current_tutor_id();
  END IF;

  -- Count direct notifications that are unread
  SELECT COUNT(*)
  INTO v_direct_count
  FROM notifications
  WHERE recipient_id = p_parent_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Count broadcast notifications within tutor context that haven't been read
  SELECT COUNT(*)
  INTO v_broadcast_count
  FROM notifications n
  WHERE n.recipient_id IS NULL
    AND n.type = 'announcement'
    AND (n.tutor_id = v_tutor_id OR n.tutor_id IS NULL)
    AND (n.expires_at IS NULL OR n.expires_at > now())
    AND NOT EXISTS (
      SELECT 1 FROM notification_reads nr
      WHERE nr.notification_id = n.id
        AND nr.parent_id = p_parent_id
    );

  RETURN v_direct_count + v_broadcast_count;
END;
$$;

-- ============================================================================
-- TRIGGERS TO AUTO-SET TUTOR_ID ON INSERT
-- ============================================================================

-- Trigger function to set tutor_id on insert for students
CREATE OR REPLACE FUNCTION set_student_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If tutor_id is not set, inherit from the parent
  IF NEW.tutor_id IS NULL THEN
    SELECT tutor_id INTO NEW.tutor_id
    FROM parents
    WHERE id = NEW.parent_id;

    -- If parent has no tutor_id (is a tutor), set to current tutor
    IF NEW.tutor_id IS NULL THEN
      NEW.tutor_id := get_current_tutor_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_student_tutor_id ON students;
CREATE TRIGGER trigger_set_student_tutor_id
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_tutor_id();

-- Trigger function to set tutor_id on insert for scheduled_lessons
CREATE OR REPLACE FUNCTION set_lesson_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If tutor_id is not set, get it from the student
  IF NEW.tutor_id IS NULL THEN
    SELECT tutor_id INTO NEW.tutor_id
    FROM students
    WHERE id = NEW.student_id;

    -- Fallback to current tutor if student has no tutor_id
    IF NEW.tutor_id IS NULL THEN
      NEW.tutor_id := get_current_tutor_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_lesson_tutor_id ON scheduled_lessons;
CREATE TRIGGER trigger_set_lesson_tutor_id
  BEFORE INSERT ON scheduled_lessons
  FOR EACH ROW
  EXECUTE FUNCTION set_lesson_tutor_id();

-- Trigger function to set tutor_id on insert for payments
CREATE OR REPLACE FUNCTION set_payment_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If tutor_id is not set, get it from the parent
  IF NEW.tutor_id IS NULL THEN
    SELECT tutor_id INTO NEW.tutor_id
    FROM parents
    WHERE id = NEW.parent_id;

    -- Fallback to current tutor
    IF NEW.tutor_id IS NULL THEN
      NEW.tutor_id := get_current_tutor_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_payment_tutor_id ON payments;
CREATE TRIGGER trigger_set_payment_tutor_id
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_tutor_id();

-- Trigger function to set tutor_id on insert for assignments
CREATE OR REPLACE FUNCTION set_assignment_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If tutor_id is not set, get it from the student
  IF NEW.tutor_id IS NULL THEN
    SELECT tutor_id INTO NEW.tutor_id
    FROM students
    WHERE id = NEW.student_id;

    -- Fallback to current tutor
    IF NEW.tutor_id IS NULL THEN
      NEW.tutor_id := get_current_tutor_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_assignment_tutor_id ON assignments;
CREATE TRIGGER trigger_set_assignment_tutor_id
  BEFORE INSERT ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION set_assignment_tutor_id();

-- Trigger function to set tutor_id on insert for parent_groups
CREATE OR REPLACE FUNCTION set_parent_group_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If tutor_id is not set, use current tutor
  IF NEW.tutor_id IS NULL THEN
    NEW.tutor_id := get_current_tutor_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_parent_group_tutor_id ON parent_groups;
CREATE TRIGGER trigger_set_parent_group_tutor_id
  BEFORE INSERT ON parent_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_parent_group_tutor_id();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view students" ON students IS 'Tutors see students in their business; parents see their own students';
COMMENT ON POLICY "Users can view parent profiles" ON parents IS 'Tutors see parents linked to them; parents see their own profile';
COMMENT ON POLICY "Users can view scheduled lessons" ON scheduled_lessons IS 'Tutors see lessons in their business; parents see their students lessons';
COMMENT ON POLICY "Users can view payments" ON payments IS 'Tutors see payments in their business; parents see their own payments';
COMMENT ON POLICY "Tutors can manage threads" ON message_threads IS 'Tutors have full CRUD on threads in their business';
COMMENT ON POLICY "Tutors can view all notifications" ON notifications IS 'Tutors see notifications in their business';
COMMENT ON POLICY "Tutors can manage groups" ON parent_groups IS 'Tutors have full CRUD on groups in their business';
COMMENT ON POLICY "Users can view assignments" ON assignments IS 'Tutors see assignments in their business; parents see their students assignments';
