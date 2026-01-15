-- Messaging system for Love2Learn
-- Supports group chats, announcements to all/groups, images, and emoji reactions

-- =====================================================
-- TABLE 1: parent_groups
-- Saved parent groups for sending messages
-- =====================================================
CREATE TABLE parent_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for querying groups by creator
CREATE INDEX idx_parent_groups_created_by ON parent_groups(created_by);

-- =====================================================
-- TABLE 2: parent_group_members
-- Junction table for group membership
-- =====================================================
CREATE TABLE parent_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES parent_groups(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_id, parent_id)
);

-- Indexes for membership queries
CREATE INDEX idx_parent_group_members_group ON parent_group_members(group_id);
CREATE INDEX idx_parent_group_members_parent ON parent_group_members(parent_id);

-- =====================================================
-- TABLE 3: message_threads
-- Conversation containers
-- =====================================================
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'group')),
  group_id UUID REFERENCES parent_groups(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for thread queries
CREATE INDEX idx_message_threads_created_by ON message_threads(created_by);
CREATE INDEX idx_message_threads_group ON message_threads(group_id);
CREATE INDEX idx_message_threads_created_at ON message_threads(created_at DESC);

-- =====================================================
-- TABLE 4: messages
-- Individual messages in threads
-- =====================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',  -- Array of storage paths (max 5)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for message queries
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(thread_id, created_at DESC);

-- =====================================================
-- TABLE 5: message_thread_participants
-- Track who can see which threads
-- =====================================================
CREATE TABLE message_thread_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(thread_id, parent_id)
);

-- Indexes for participant queries
CREATE INDEX idx_message_thread_participants_thread ON message_thread_participants(thread_id);
CREATE INDEX idx_message_thread_participants_parent ON message_thread_participants(parent_id);
CREATE INDEX idx_message_thread_participants_unread ON message_thread_participants(parent_id, last_read_at);

-- =====================================================
-- TABLE 6: message_reactions
-- Emoji reactions on messages
-- =====================================================
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(message_id, parent_id, emoji)  -- One reaction per emoji per user
);

-- Indexes for reaction queries
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_parent ON message_reactions(parent_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE parent_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES: parent_groups
-- =====================================================

-- Tutors can manage all groups
CREATE POLICY "Tutors can manage groups"
  ON parent_groups
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

-- Parents can view groups they are members of
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

-- =====================================================
-- RLS POLICIES: parent_group_members
-- =====================================================

-- Tutors can manage all memberships
CREATE POLICY "Tutors can manage group members"
  ON parent_group_members
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

-- Parents can view memberships of groups they belong to
CREATE POLICY "Parents can view group members"
  ON parent_group_members
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND
    EXISTS (
      SELECT 1 FROM parent_group_members pgm2
      WHERE pgm2.group_id = parent_group_members.group_id
        AND pgm2.parent_id = get_parent_id()
    )
  );

-- =====================================================
-- RLS POLICIES: message_threads
-- =====================================================

-- Tutors can manage all threads
CREATE POLICY "Tutors can manage threads"
  ON message_threads
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

-- Parents can view threads they are participants in
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

-- =====================================================
-- RLS POLICIES: messages
-- =====================================================

-- Tutors can manage all messages
CREATE POLICY "Tutors can manage messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

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

-- =====================================================
-- RLS POLICIES: message_thread_participants
-- =====================================================

-- Tutors can manage all participants
CREATE POLICY "Tutors can manage participants"
  ON message_thread_participants
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

-- Parents can view participants in their threads
CREATE POLICY "Parents can view thread participants"
  ON message_thread_participants
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND
    EXISTS (
      SELECT 1 FROM message_thread_participants mtp2
      WHERE mtp2.thread_id = message_thread_participants.thread_id
        AND mtp2.parent_id = get_parent_id()
    )
  );

-- Parents can update their own last_read_at
CREATE POLICY "Parents can update their read status"
  ON message_thread_participants
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_tutor() AND
    parent_id = get_parent_id()
  )
  WITH CHECK (
    NOT is_tutor() AND
    parent_id = get_parent_id()
  );

-- =====================================================
-- RLS POLICIES: message_reactions
-- =====================================================

-- Tutors can manage all reactions
CREATE POLICY "Tutors can manage reactions"
  ON message_reactions
  FOR ALL
  TO authenticated
  USING (is_tutor())
  WITH CHECK (is_tutor());

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
    NOT is_tutor() AND
    parent_id = get_parent_id()
  );

-- =====================================================
-- ENABLE REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE message_thread_participants;

-- =====================================================
-- FUNCTION: create_message_thread
-- Creates a thread with initial message and adds all participants
-- =====================================================
CREATE OR REPLACE FUNCTION create_message_thread(
  p_subject TEXT,
  p_content TEXT,
  p_sender_id UUID,
  p_recipient_type TEXT,  -- 'all' or 'group'
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
BEGIN
  -- Validate recipient_type
  IF p_recipient_type NOT IN ('all', 'group') THEN
    RAISE EXCEPTION 'Invalid recipient_type. Must be "all" or "group"';
  END IF;

  -- If group, validate group exists
  IF p_recipient_type = 'group' AND p_group_id IS NULL THEN
    RAISE EXCEPTION 'group_id is required when recipient_type is "group"';
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

  -- Add recipients as participants
  IF p_recipient_type = 'all' THEN
    -- Add all parents (except the sender)
    FOR v_parent_record IN
      SELECT id FROM parents
      WHERE role = 'parent' AND id != p_sender_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.id);
    END LOOP;
  ELSE
    -- Add group members (except the sender)
    FOR v_parent_record IN
      SELECT parent_id FROM parent_group_members
      WHERE group_id = p_group_id AND parent_id != p_sender_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.parent_id);
    END LOOP;
  END IF;

  RETURN v_thread_id;
END;
$$;

-- =====================================================
-- FUNCTION: send_message
-- Sends a message to an existing thread
-- =====================================================
CREATE OR REPLACE FUNCTION send_message(
  p_thread_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_images TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_is_participant BOOLEAN;
BEGIN
  -- Check if sender is a participant
  SELECT EXISTS (
    SELECT 1 FROM message_thread_participants
    WHERE thread_id = p_thread_id AND parent_id = p_sender_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Sender is not a participant in this thread';
  END IF;

  -- Create the message
  INSERT INTO messages (thread_id, sender_id, content, images)
  VALUES (p_thread_id, p_sender_id, p_content, p_images)
  RETURNING id INTO v_message_id;

  -- Update thread's updated_at
  UPDATE message_threads
  SET updated_at = now()
  WHERE id = p_thread_id;

  -- Update sender's last_read_at
  UPDATE message_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id AND parent_id = p_sender_id;

  RETURN v_message_id;
END;
$$;

-- =====================================================
-- FUNCTION: get_unread_message_count
-- Returns count of unread messages for a user
-- =====================================================
CREATE OR REPLACE FUNCTION get_unread_message_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT m.id)
  INTO v_count
  FROM messages m
  JOIN message_thread_participants mtp ON mtp.thread_id = m.thread_id
  WHERE mtp.parent_id = p_parent_id
    AND m.sender_id != p_parent_id  -- Don't count own messages
    AND (mtp.last_read_at IS NULL OR m.created_at > mtp.last_read_at);

  RETURN COALESCE(v_count, 0);
END;
$$;

-- =====================================================
-- FUNCTION: mark_thread_read
-- Marks a thread as read for a user
-- =====================================================
CREATE OR REPLACE FUNCTION mark_thread_read(
  p_thread_id UUID,
  p_parent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE message_thread_participants
  SET last_read_at = now()
  WHERE thread_id = p_thread_id
    AND parent_id = p_parent_id;

  RETURN FOUND;
END;
$$;

-- =====================================================
-- FUNCTION: toggle_reaction
-- Adds or removes a reaction (toggle behavior)
-- =====================================================
CREATE OR REPLACE FUNCTION toggle_reaction(
  p_message_id UUID,
  p_parent_id UUID,
  p_emoji TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if reaction already exists
  SELECT EXISTS (
    SELECT 1 FROM message_reactions
    WHERE message_id = p_message_id
      AND parent_id = p_parent_id
      AND emoji = p_emoji
  ) INTO v_exists;

  IF v_exists THEN
    -- Remove the reaction
    DELETE FROM message_reactions
    WHERE message_id = p_message_id
      AND parent_id = p_parent_id
      AND emoji = p_emoji;
    RETURN FALSE;  -- Reaction was removed
  ELSE
    -- Add the reaction
    INSERT INTO message_reactions (message_id, parent_id, emoji)
    VALUES (p_message_id, p_parent_id, p_emoji);
    RETURN TRUE;  -- Reaction was added
  END IF;
END;
$$;

-- =====================================================
-- FUNCTION: get_threads_with_preview
-- Gets threads for a user with latest message preview
-- =====================================================
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
BEGIN
  RETURN QUERY
  WITH participant_threads AS (
    SELECT mtp.thread_id, mtp.last_read_at
    FROM message_thread_participants mtp
    WHERE mtp.parent_id = p_parent_id
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
          AND (pt.last_read_at IS NULL OR m.created_at > pt.last_read_at)
      ) AS unread
    FROM messages m
    JOIN participant_threads pt ON pt.thread_id = m.thread_id
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
  JOIN participant_threads pt ON pt.thread_id = mt.id
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

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION create_message_thread TO authenticated;
GRANT EXECUTE ON FUNCTION send_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_thread_read TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_reaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_threads_with_preview TO authenticated;

-- =====================================================
-- TRIGGER: update_thread_timestamp
-- Updates thread's updated_at when a message is added
-- =====================================================
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_thread_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_timestamp();
