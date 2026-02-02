-- Migration: Fix message_threads RLS recursion
-- Version: 20260201000011
-- Description: Fixes infinite recursion in message_threads RLS policies
--              by using SECURITY DEFINER functions to bypass RLS during checks
--
-- Problem: The message_threads policy checks message_thread_participants,
--          and message_thread_participants policy checks message_threads,
--          causing infinite recursion.
--
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS.

-- ============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user is a participant in a thread (bypasses RLS)
CREATE OR REPLACE FUNCTION is_thread_participant(p_thread_id UUID, p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM message_thread_participants
    WHERE thread_id = p_thread_id
      AND parent_id = p_parent_id
  );
END;
$$;

COMMENT ON FUNCTION is_thread_participant(UUID, UUID) IS 'Checks if a parent is a participant in a thread. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
GRANT EXECUTE ON FUNCTION is_thread_participant(UUID, UUID) TO authenticated;

-- Function to check if a thread belongs to a tutor (bypasses RLS)
CREATE OR REPLACE FUNCTION is_tutor_thread(p_thread_id UUID, p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM message_threads
    WHERE id = p_thread_id
      AND (tutor_id = p_tutor_id OR tutor_id IS NULL)
  );
END;
$$;

COMMENT ON FUNCTION is_tutor_thread(UUID, UUID) IS 'Checks if a thread belongs to a tutor. Uses SECURITY DEFINER to bypass RLS and avoid recursion.';
GRANT EXECUTE ON FUNCTION is_tutor_thread(UUID, UUID) TO authenticated;

-- ============================================================================
-- UPDATE MESSAGE_THREADS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage threads" ON message_threads;
DROP POLICY IF EXISTS "Parents can view their threads" ON message_threads;

-- Tutors can manage threads in their business (no change needed, doesn't cause recursion)
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

-- Parents can view threads they participate in (use helper function to avoid recursion)
CREATE POLICY "Parents can view their threads"
ON message_threads
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND is_thread_participant(id, get_parent_id())
);

-- ============================================================================
-- UPDATE MESSAGE_THREAD_PARTICIPANTS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage participants" ON message_thread_participants;
DROP POLICY IF EXISTS "Parents can view own participation" ON message_thread_participants;
DROP POLICY IF EXISTS "Parents can update their read status" ON message_thread_participants;

-- Tutors can manage participants (use helper function to avoid recursion)
CREATE POLICY "Tutors can manage participants"
ON message_thread_participants
FOR ALL
TO authenticated
USING (
    is_tutor() AND is_tutor_thread(thread_id, get_current_tutor_id())
)
WITH CHECK (
    is_tutor() AND is_tutor_thread(thread_id, get_current_tutor_id())
);

-- Parents can view their own participation records (simple, no recursion)
CREATE POLICY "Parents can view own participation"
ON message_thread_participants
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- Parents can update their own last_read_at (simple, no recursion)
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
-- UPDATE MESSAGES POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage messages" ON messages;
DROP POLICY IF EXISTS "Parents can view thread messages" ON messages;
DROP POLICY IF EXISTS "Parents can send messages" ON messages;

-- Tutors can manage messages (use helper function)
CREATE POLICY "Tutors can manage messages"
ON messages
FOR ALL
TO authenticated
USING (
    is_tutor() AND is_tutor_thread(thread_id, get_current_tutor_id())
)
WITH CHECK (
    is_tutor() AND is_tutor_thread(thread_id, get_current_tutor_id())
);

-- Parents can view messages in threads they participate in
CREATE POLICY "Parents can view thread messages"
ON messages
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND is_thread_participant(thread_id, get_parent_id())
);

-- Parents can send messages to threads they participate in
CREATE POLICY "Parents can send messages"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
    NOT is_tutor() AND
    sender_id = get_parent_id() AND
    is_thread_participant(thread_id, get_parent_id())
);

-- ============================================================================
-- UPDATE MESSAGE_REACTIONS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Tutors can manage reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can view reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can add reactions" ON message_reactions;
DROP POLICY IF EXISTS "Parents can remove own reactions" ON message_reactions;

-- Function to check if a message is in a tutor's thread
CREATE OR REPLACE FUNCTION is_message_in_tutor_thread(p_message_id UUID, p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM messages m
    JOIN message_threads mt ON mt.id = m.thread_id
    WHERE m.id = p_message_id
      AND (mt.tutor_id = p_tutor_id OR mt.tutor_id IS NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_message_in_tutor_thread(UUID, UUID) TO authenticated;

-- Function to check if a message is in a thread the parent participates in
CREATE OR REPLACE FUNCTION is_message_in_participant_thread(p_message_id UUID, p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  SELECT thread_id INTO v_thread_id FROM messages WHERE id = p_message_id;
  IF v_thread_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN is_thread_participant(v_thread_id, p_parent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION is_message_in_participant_thread(UUID, UUID) TO authenticated;

-- Tutors can manage reactions
CREATE POLICY "Tutors can manage reactions"
ON message_reactions
FOR ALL
TO authenticated
USING (
    is_tutor() AND is_message_in_tutor_thread(message_id, get_current_tutor_id())
)
WITH CHECK (
    is_tutor() AND is_message_in_tutor_thread(message_id, get_current_tutor_id())
);

-- Parents can view reactions
CREATE POLICY "Parents can view reactions"
ON message_reactions
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND is_message_in_participant_thread(message_id, get_parent_id())
);

-- Parents can add reactions
CREATE POLICY "Parents can add reactions"
ON message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
    NOT is_tutor() AND
    parent_id = get_parent_id() AND
    is_message_in_participant_thread(message_id, get_parent_id())
);

-- Parents can remove own reactions
CREATE POLICY "Parents can remove own reactions"
ON message_reactions
FOR DELETE
TO authenticated
USING (
    NOT is_tutor() AND parent_id = get_parent_id()
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Message threads RLS recursion fix applied successfully';
  RAISE NOTICE 'Created SECURITY DEFINER functions: is_thread_participant, is_tutor_thread, is_message_in_tutor_thread, is_message_in_participant_thread';
END $$;
