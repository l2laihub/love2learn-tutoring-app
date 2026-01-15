-- Fix infinite recursion in RLS policies for messaging system
-- The issue is that policies on parent_group_members and message_thread_participants
-- were querying the same tables they were protecting, causing infinite recursion

-- =====================================================
-- FIX: parent_group_members policy
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Parents can view group members" ON parent_group_members;

-- New policy: Parents can only view their own membership records directly
-- To see all members of a group, use the get_group_members RPC function
CREATE POLICY "Parents can view own membership"
  ON parent_group_members
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND
    parent_id = get_parent_id()
  );

-- =====================================================
-- FIX: message_thread_participants policy
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Parents can view thread participants" ON message_thread_participants;

-- New policy: Parents can only view their own participation records directly
-- To see all participants in a thread, use the get_thread_participants RPC function
CREATE POLICY "Parents can view own participation"
  ON message_thread_participants
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND
    parent_id = get_parent_id()
  );

-- =====================================================
-- FUNCTION: get_group_members
-- Returns all members of a group (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION get_group_members(p_group_id UUID)
RETURNS TABLE (
  id UUID,
  group_id UUID,
  parent_id UUID,
  added_at TIMESTAMPTZ,
  parent_name TEXT,
  parent_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pgm.id,
    pgm.group_id,
    pgm.parent_id,
    pgm.added_at,
    p.name AS parent_name,
    p.email AS parent_email
  FROM parent_group_members pgm
  JOIN parents p ON p.id = pgm.parent_id
  WHERE pgm.group_id = p_group_id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_group_members TO authenticated;

-- =====================================================
-- FUNCTION: get_thread_participants
-- Returns all participants of a thread (bypasses RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION get_thread_participants(p_thread_id UUID)
RETURNS TABLE (
  id UUID,
  thread_id UUID,
  parent_id UUID,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  parent_name TEXT,
  parent_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_id UUID;
  v_is_participant BOOLEAN;
BEGIN
  -- Get current user's parent_id
  v_parent_id := get_parent_id();

  -- Check if user is a participant (or is tutor)
  SELECT EXISTS (
    SELECT 1 FROM message_thread_participants
    WHERE message_thread_participants.thread_id = p_thread_id
      AND message_thread_participants.parent_id = v_parent_id
  ) INTO v_is_participant;

  -- Only return participants if user is part of the thread or is tutor
  IF NOT v_is_participant AND NOT is_tutor() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    mtp.id,
    mtp.thread_id,
    mtp.parent_id,
    mtp.last_read_at,
    mtp.joined_at,
    p.name AS parent_name,
    p.email AS parent_email
  FROM message_thread_participants mtp
  JOIN parents p ON p.id = mtp.parent_id
  WHERE mtp.thread_id = p_thread_id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_thread_participants TO authenticated;

-- =====================================================
-- FUNCTION: get_parent_groups_with_members
-- Returns groups with their members (for tutor use)
-- =====================================================
CREATE OR REPLACE FUNCTION get_parent_groups_with_members()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  member_count BIGINT,
  members JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only tutors should use this function
  IF NOT is_tutor() THEN
    RAISE EXCEPTION 'Only tutors can view all groups with members';
  END IF;

  RETURN QUERY
  SELECT
    pg.id,
    pg.name,
    pg.description,
    pg.created_by,
    pg.created_at,
    pg.updated_at,
    COUNT(pgm.id) AS member_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email
        )
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::jsonb
    ) AS members
  FROM parent_groups pg
  LEFT JOIN parent_group_members pgm ON pgm.group_id = pg.id
  LEFT JOIN parents p ON p.id = pgm.parent_id
  GROUP BY pg.id, pg.name, pg.description, pg.created_by, pg.created_at, pg.updated_at
  ORDER BY pg.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_parent_groups_with_members TO authenticated;
