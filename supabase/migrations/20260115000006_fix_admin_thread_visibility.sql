-- Fix admin/tutor visibility for all message threads
-- Tutors should be able to see and manage ALL threads, not just ones they participate in

CREATE OR REPLACE FUNCTION get_threads_with_preview(
  p_parent_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  subject TEXT,
  created_by UUID,
  creator_name TEXT,
  recipient_type TEXT,
  group_id UUID,
  group_name TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  latest_message_id UUID,
  latest_message_content TEXT,
  latest_message_sender_id UUID,
  latest_message_sender_name TEXT,
  latest_message_created_at TIMESTAMPTZ,
  unread_count BIGINT,
  participant_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_tutor BOOLEAN;
BEGIN
  -- Check if user is a tutor/admin
  v_is_tutor := is_tutor();

  RETURN QUERY
  WITH participant_threads AS (
    -- For tutors: get all threads
    -- For parents: only get threads they participate in
    SELECT mtp.thread_id, mtp.last_read_at
    FROM message_thread_participants mtp
    WHERE v_is_tutor OR mtp.parent_id = p_parent_id
  ),
  all_threads AS (
    -- For tutors: include ALL threads (even those without participants yet)
    SELECT mt.id AS thread_id, NULL::TIMESTAMPTZ AS last_read_at
    FROM message_threads mt
    WHERE v_is_tutor
  ),
  combined_threads AS (
    -- Combine participant threads with all threads for tutors
    SELECT DISTINCT ON (thread_id) thread_id, last_read_at
    FROM (
      SELECT thread_id, last_read_at FROM participant_threads
      UNION ALL
      SELECT thread_id, last_read_at FROM all_threads WHERE v_is_tutor
    ) combined
    ORDER BY thread_id, last_read_at DESC NULLS LAST
  ),
  latest_messages AS (
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id,
      m.id AS message_id,
      m.content,
      m.sender_id,
      m.created_at AS message_created_at,
      p.name AS sender_name
    FROM messages m
    JOIN parents p ON p.id = m.sender_id
    ORDER BY m.thread_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT
      m.thread_id,
      COUNT(*) FILTER (
        WHERE m.sender_id != p_parent_id
          AND (ct.last_read_at IS NULL OR m.created_at > ct.last_read_at)
      ) AS unread
    FROM messages m
    JOIN combined_threads ct ON ct.thread_id = m.thread_id
    GROUP BY m.thread_id
  ),
  participant_counts AS (
    SELECT thread_id, COUNT(*) AS cnt
    FROM message_thread_participants
    GROUP BY thread_id
  )
  SELECT
    mt.id,
    mt.subject,
    mt.created_by,
    creator.name AS creator_name,
    mt.recipient_type,
    mt.group_id,
    pg.name AS group_name,
    mt.is_active,
    mt.created_at,
    mt.updated_at,
    lm.message_id AS latest_message_id,
    lm.content AS latest_message_content,
    lm.sender_id AS latest_message_sender_id,
    lm.sender_name AS latest_message_sender_name,
    lm.message_created_at AS latest_message_created_at,
    COALESCE(uc.unread, 0) AS unread_count,
    COALESCE(pc.cnt, 0) AS participant_count
  FROM message_threads mt
  JOIN combined_threads ct ON ct.thread_id = mt.id
  JOIN parents creator ON creator.id = mt.created_by
  LEFT JOIN parent_groups pg ON pg.id = mt.group_id
  LEFT JOIN latest_messages lm ON lm.thread_id = mt.id
  LEFT JOIN unread_counts uc ON uc.thread_id = mt.id
  LEFT JOIN participant_counts pc ON pc.thread_id = mt.id
  WHERE mt.is_active = true
  ORDER BY COALESCE(lm.message_created_at, mt.created_at) DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_threads_with_preview TO authenticated;
