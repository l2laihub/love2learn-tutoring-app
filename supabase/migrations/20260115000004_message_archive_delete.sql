-- Archive and delete functions for messaging system
-- Tutors can archive/delete threads, users can delete their own messages

-- =====================================================
-- FUNCTION: archive_thread
-- Archives a thread (sets is_active = false)
-- Only tutors can archive threads
-- =====================================================
CREATE OR REPLACE FUNCTION archive_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only tutors can archive threads
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can archive threads';
  END IF;

  UPDATE message_threads
  SET is_active = false, updated_at = now()
  WHERE id = p_thread_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- FUNCTION: unarchive_thread
-- Unarchives a thread (sets is_active = true)
-- Only tutors can unarchive threads
-- =====================================================
CREATE OR REPLACE FUNCTION unarchive_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only tutors can unarchive threads
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can unarchive threads';
  END IF;

  UPDATE message_threads
  SET is_active = true, updated_at = now()
  WHERE id = p_thread_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- FUNCTION: delete_message
-- Deletes a message (tutors can delete any, users their own)
-- =====================================================
CREATE OR REPLACE FUNCTION delete_message(p_message_id UUID, p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_id UUID;
BEGIN
  -- Get the sender of the message
  SELECT sender_id INTO v_sender_id
  FROM messages
  WHERE id = p_message_id;

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Only allow deletion if tutor OR own message
  IF NOT is_tutor() AND v_sender_id != p_parent_id THEN
    RAISE EXCEPTION 'Can only delete your own messages';
  END IF;

  -- Delete the message (reactions will cascade)
  DELETE FROM messages WHERE id = p_message_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- FUNCTION: delete_thread
-- Permanently deletes a thread and all its messages
-- Only tutors can delete threads
-- =====================================================
CREATE OR REPLACE FUNCTION delete_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only tutors can delete threads
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can delete threads';
  END IF;

  -- Delete the thread (messages, participants, etc. will cascade)
  DELETE FROM message_threads WHERE id = p_thread_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION archive_thread TO authenticated;
GRANT EXECUTE ON FUNCTION unarchive_thread TO authenticated;
GRANT EXECUTE ON FUNCTION delete_message TO authenticated;
GRANT EXECUTE ON FUNCTION delete_thread TO authenticated;
