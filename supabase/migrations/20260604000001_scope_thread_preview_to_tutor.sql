-- Migration: Fix orphaned (NULL tutor_id) message threads
-- Version: 20260604000001
-- Description: Fixes "Conversation not found" when opening a thread the current
--              tutor created, plus related cross-tutor leaks in messaging.
--
-- ROOT CAUSE
--   The app calls create_message_thread() with 7 arguments (it always passes
--   p_parent_ids). Two overloads of that function exist:
--     * 7-arg version (20260130000001_message_individual_parent.sql) - the one
--       the app actually calls - inserts into message_threads WITHOUT tutor_id,
--       so every thread created through the app gets tutor_id = NULL.
--     * 6-arg version (20260201000005_multi_tutor_rls.sql) - DOES set tutor_id,
--       but is never called. Postgres keeps both as distinct overloads.
--
--   Since 20260202000002_remove_legacy_null_fallback.sql removed the
--   "OR tutor_id IS NULL" escape hatch, the message_threads SELECT policy is:
--       is_tutor() AND tutor_id = get_current_tutor_id()
--   A NULL tutor_id never satisfies this, so the thread's own creator cannot
--   open it -> "Conversation not found" (the list still shows it because
--   get_threads_with_preview is SECURITY DEFINER and was unscoped).
--
--   The 7-arg version also adds ALL parents (every tutor's) as participants for
--   recipient_type='all', leaking recipients across tutors.
--
-- FIX
--   1. Replace the 7-arg create_message_thread so it stamps tutor_id and scopes
--      'all' recipients to the current tutor's own parents.
--   2. Drop the dead 6-arg overload to remove the ambiguity.
--   3. Add a BEFORE INSERT trigger as defence-in-depth: any future insert path
--      that forgets tutor_id gets it stamped from the creator automatically.
--   4. Backfill existing threads whose tutor_id is NULL, derived from created_by.
--   5. Scope get_threads_with_preview to the current tutor so the list matches
--      the detail-screen RLS (each listed thread is openable; no cross-tutor leak).

-- ============================================================================
-- 1. Canonical create_message_thread (7-arg) - now sets tutor_id + scopes 'all'
-- ============================================================================

CREATE OR REPLACE FUNCTION create_message_thread(
  p_subject TEXT,
  p_content TEXT,
  p_sender_id UUID,
  p_recipient_type TEXT,        -- 'all', 'group', or 'parent'
  p_group_id UUID DEFAULT NULL,
  p_images TEXT[] DEFAULT '{}',
  p_parent_ids UUID[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_parent_record RECORD;
  v_parent_id UUID;
  v_tutor_id UUID;
BEGIN
  -- Resolve the tutor (business) this thread belongs to.
  v_tutor_id := get_current_tutor_id();

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

  -- Create the thread WITH tutor_id (previously omitted -> NULL).
  INSERT INTO message_threads (subject, created_by, recipient_type, group_id, tutor_id)
  VALUES (p_subject, p_sender_id, p_recipient_type, p_group_id, v_tutor_id)
  RETURNING id INTO v_thread_id;

  -- Create the initial message
  INSERT INTO messages (thread_id, sender_id, content, images)
  VALUES (v_thread_id, p_sender_id, p_content, p_images);

  -- Add sender as participant (the tutor)
  INSERT INTO message_thread_participants (thread_id, parent_id, last_read_at)
  VALUES (v_thread_id, p_sender_id, now());

  -- Add recipients as participants based on recipient_type
  IF p_recipient_type = 'all' THEN
    -- Add all parents that belong to THIS tutor (was previously every tutor's).
    FOR v_parent_record IN
      SELECT id FROM parents
      WHERE role = 'parent'
        AND id != p_sender_id
        AND tutor_id = v_tutor_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.id)
      ON CONFLICT (thread_id, parent_id) DO NOTHING;
    END LOOP;
  ELSIF p_recipient_type = 'group' THEN
    -- Add group members (except the sender)
    FOR v_parent_record IN
      SELECT parent_id FROM parent_group_members
      WHERE group_id = p_group_id AND parent_id != p_sender_id
    LOOP
      INSERT INTO message_thread_participants (thread_id, parent_id)
      VALUES (v_thread_id, v_parent_record.parent_id)
      ON CONFLICT (thread_id, parent_id) DO NOTHING;
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

GRANT EXECUTE ON FUNCTION create_message_thread(TEXT, TEXT, UUID, TEXT, UUID, TEXT[], UUID[]) TO authenticated;

-- ============================================================================
-- 2. Remove the dead 6-arg overload so there is exactly one canonical function
-- ============================================================================

DROP FUNCTION IF EXISTS create_message_thread(TEXT, TEXT, UUID, TEXT, UUID, TEXT[]);

-- ============================================================================
-- 3. Defence in depth: stamp tutor_id on insert if a caller ever omits it
-- ============================================================================

CREATE OR REPLACE FUNCTION set_message_thread_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tutor_id IS NULL THEN
    NEW.tutor_id := COALESCE(
      -- creator is a tutor -> their own id is the business id
      (SELECT p.id FROM parents p WHERE p.id = NEW.created_by AND p.role = 'tutor'),
      -- creator is a parent -> use the tutor they belong to
      (SELECT p.tutor_id FROM parents p WHERE p.id = NEW.created_by),
      -- last resort: the current auth context's tutor
      get_current_tutor_id()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_message_thread_tutor_id ON message_threads;
CREATE TRIGGER trg_set_message_thread_tutor_id
  BEFORE INSERT ON message_threads
  FOR EACH ROW
  EXECUTE FUNCTION set_message_thread_tutor_id();

-- ============================================================================
-- 4. Backfill existing orphaned threads (tutor_id IS NULL)
-- ============================================================================

UPDATE message_threads mt
SET tutor_id = COALESCE(
  (SELECT p.id FROM parents p WHERE p.id = mt.created_by AND p.role = 'tutor'),
  (SELECT p.tutor_id FROM parents p WHERE p.id = mt.created_by)
)
WHERE mt.tutor_id IS NULL;

-- ============================================================================
-- 5. Scope get_threads_with_preview to the current tutor (list <-> detail parity)
-- ============================================================================

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
  v_tutor_id UUID;
BEGIN
  v_is_tutor := is_tutor();
  v_tutor_id := get_current_tutor_id();

  RETURN QUERY
  WITH participant_threads AS (
    -- Threads this specific user participates in (parents, and any tutor who
    -- was explicitly added as a participant).
    SELECT mtp.thread_id, mtp.last_read_at
    FROM message_thread_participants mtp
    WHERE mtp.parent_id = p_parent_id
  ),
  tutor_threads AS (
    -- For tutors: every thread in THEIR business, scoped by tutor_id.
    SELECT mt.id AS thread_id, NULL::TIMESTAMPTZ AS last_read_at
    FROM message_threads mt
    WHERE v_is_tutor AND mt.tutor_id = v_tutor_id
  ),
  combined_threads AS (
    SELECT DISTINCT ON (thread_id) thread_id, last_read_at
    FROM (
      SELECT thread_id, last_read_at FROM participant_threads
      UNION ALL
      SELECT thread_id, last_read_at FROM tutor_threads
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
    -- Defence in depth: never return another tutor's thread.
    AND (NOT v_is_tutor OR mt.tutor_id = v_tutor_id)
  ORDER BY COALESCE(lm.message_created_at, mt.created_at) DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_threads_with_preview(UUID, INTEGER) IS
  'Returns threads with preview for the messages list. Tutors see only threads in their own business (tutor_id = get_current_tutor_id()); parents see threads they participate in. Kept consistent with message_threads RLS so every listed thread is openable.';

GRANT EXECUTE ON FUNCTION get_threads_with_preview(UUID, INTEGER) TO authenticated;
