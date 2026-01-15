-- RPC function to get thread messages with sender info
-- This bypasses RLS to allow viewing sender info in message threads

CREATE OR REPLACE FUNCTION get_thread_messages(p_thread_id UUID, p_parent_id UUID)
RETURNS TABLE (
  id UUID,
  thread_id UUID,
  sender_id UUID,
  content TEXT,
  images TEXT[],
  created_at TIMESTAMPTZ,
  sender_name TEXT,
  sender_email TEXT,
  sender_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_participant BOOLEAN;
BEGIN
  -- Check if user is a participant (or is tutor)
  SELECT EXISTS (
    SELECT 1 FROM message_thread_participants
    WHERE message_thread_participants.thread_id = p_thread_id
      AND message_thread_participants.parent_id = p_parent_id
  ) INTO v_is_participant;

  -- Only return messages if user is part of the thread or is tutor
  IF NOT v_is_participant AND NOT (SELECT is_tutor()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.thread_id,
    m.sender_id,
    m.content,
    m.images,
    m.created_at,
    p.name AS sender_name,
    p.email AS sender_email,
    p.role AS sender_role
  FROM messages m
  JOIN parents p ON p.id = m.sender_id
  WHERE m.thread_id = p_thread_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_thread_messages TO authenticated;
