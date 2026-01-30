-- Migration: Add 'parent' recipient type for sending messages to individual parents
-- This allows tutors to send messages to specific selected parents instead of all or groups

-- =====================================================
-- Step 1: Update the recipient_type constraint
-- =====================================================

-- Drop the existing constraint
ALTER TABLE message_threads
DROP CONSTRAINT message_threads_recipient_type_check;

-- Add the new constraint with 'parent' type
ALTER TABLE message_threads
ADD CONSTRAINT message_threads_recipient_type_check
CHECK (recipient_type IN ('all', 'group', 'parent'));

-- =====================================================
-- Step 2: Update the create_message_thread function
-- Add p_parent_ids parameter to support individual parent selection
-- =====================================================

CREATE OR REPLACE FUNCTION create_message_thread(
  p_subject TEXT,
  p_content TEXT,
  p_sender_id UUID,
  p_recipient_type TEXT,  -- 'all', 'group', or 'parent'
  p_group_id UUID DEFAULT NULL,
  p_images TEXT[] DEFAULT '{}',
  p_parent_ids UUID[] DEFAULT '{}'  -- New parameter for individual parent selection
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id UUID;
  v_parent_record RECORD;
  v_parent_id UUID;
BEGIN
  -- Validate recipient_type
  IF p_recipient_type NOT IN ('all', 'group', 'parent') THEN
    RAISE EXCEPTION 'Invalid recipient_type. Must be "all", "group", or "parent"';
  END IF;

  -- If group, validate group exists
  IF p_recipient_type = 'group' AND p_group_id IS NULL THEN
    RAISE EXCEPTION 'group_id is required when recipient_type is "group"';
  END IF;

  -- If parent, validate parent_ids is not empty
  IF p_recipient_type = 'parent' AND (p_parent_ids IS NULL OR array_length(p_parent_ids, 1) IS NULL) THEN
    RAISE EXCEPTION 'parent_ids is required when recipient_type is "parent"';
  END IF;

  -- Create the thread
  INSERT INTO message_threads (subject, created_by, recipient_type, group_id)
  VALUES (p_subject, p_sender_id, p_recipient_type, p_group_id)
  RETURNING id INTO v_thread_id;

  -- Create the initial message
  INSERT INTO messages (thread_id, sender_id, content, images)
  VALUES (v_thread_id, p_sender_id, p_content, p_images);

  -- Add sender as participant (tutor)
  INSERT INTO message_thread_participants (thread_id, parent_id, last_read_at)
  VALUES (v_thread_id, p_sender_id, now());

  -- Add recipients as participants based on recipient_type
  IF p_recipient_type = 'all' THEN
    -- Add all parents (except the sender)
    FOR v_parent_record IN
      SELECT id FROM parents
      WHERE role = 'parent' AND id != p_sender_id
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
  ELSIF p_recipient_type = 'parent' THEN
    -- Add individual parents from the provided list (except the sender)
    FOREACH v_parent_id IN ARRAY p_parent_ids
    LOOP
      IF v_parent_id != p_sender_id THEN
        INSERT INTO message_thread_participants (thread_id, parent_id)
        VALUES (v_thread_id, v_parent_id)
        ON CONFLICT (thread_id, parent_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_thread_id;
END;
$$;
