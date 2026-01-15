-- Bulk delete functions for tutors
-- Allows tutors to delete multiple messages/threads at once

-- =====================================================
-- FUNCTION: bulk_delete_messages
-- Deletes multiple messages at once (tutor only)
-- =====================================================
CREATE OR REPLACE FUNCTION bulk_delete_messages(p_message_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Only tutors can bulk delete messages
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can bulk delete messages';
  END IF;

  -- Delete messages (reactions will cascade)
  DELETE FROM messages
  WHERE id = ANY(p_message_ids);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- FUNCTION: bulk_delete_threads
-- Deletes multiple threads at once (tutor only)
-- =====================================================
CREATE OR REPLACE FUNCTION bulk_delete_threads(p_thread_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Only tutors can bulk delete threads
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can bulk delete threads';
  END IF;

  -- Delete threads (messages, participants, etc. will cascade)
  DELETE FROM message_threads
  WHERE id = ANY(p_thread_ids);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- FUNCTION: bulk_archive_threads
-- Archives multiple threads at once (tutor only)
-- =====================================================
CREATE OR REPLACE FUNCTION bulk_archive_threads(p_thread_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Only tutors can bulk archive threads
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can archive threads';
  END IF;

  -- Archive threads
  UPDATE message_threads
  SET is_active = false, updated_at = now()
  WHERE id = ANY(p_thread_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION bulk_delete_messages TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_delete_threads TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_archive_threads TO authenticated;
