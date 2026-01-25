-- Migration: Fix notification count for tutors v3
-- Version: 20260122000007
-- Description: Fixes the notification count for tutors to also check notification_reads table
--              when counting broadcast notifications. The mark_notification_read function
--              inserts into notification_reads for broadcasts but doesn't update read_at.

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_direct_count INTEGER;
  v_broadcast_count INTEGER;
  v_is_tutor BOOLEAN;
BEGIN
  -- Check if user is a tutor by looking up their role directly
  SELECT (role = 'tutor') INTO v_is_tutor
  FROM parents
  WHERE id = p_parent_id;

  -- Default to false if not found
  v_is_tutor := COALESCE(v_is_tutor, false);

  -- Count direct notifications that are unread
  SELECT COUNT(*)
  INTO v_direct_count
  FROM notifications
  WHERE recipient_id = p_parent_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Count broadcast notifications
  IF v_is_tutor THEN
    -- For tutors: count ALL unread broadcast notifications (requests, announcements, etc.)
    -- that the tutor hasn't read (check notification_reads table)
    SELECT COUNT(*)
    INTO v_broadcast_count
    FROM notifications n
    WHERE n.recipient_id IS NULL
      AND (n.expires_at IS NULL OR n.expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id
          AND nr.parent_id = p_parent_id
      );
  ELSE
    -- For parents: only count announcements that they haven't read
    SELECT COUNT(*)
    INTO v_broadcast_count
    FROM notifications n
    WHERE n.recipient_id IS NULL
      AND n.type = 'announcement'
      AND (n.expires_at IS NULL OR n.expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id
          AND nr.parent_id = p_parent_id
      );
  END IF;

  RETURN v_direct_count + v_broadcast_count;
END;
$$;
