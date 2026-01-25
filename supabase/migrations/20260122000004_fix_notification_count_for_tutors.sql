-- Migration: Fix notification count for tutors
-- Version: 20260122000004
-- Description: Updates get_unread_notification_count to include all broadcast notifications,
--              not just announcements. This allows tutors to see enrollment and reschedule requests.

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
  -- Check if user is a tutor
  SELECT is_tutor() INTO v_is_tutor;

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
    SELECT COUNT(*)
    INTO v_broadcast_count
    FROM notifications n
    WHERE n.recipient_id IS NULL
      AND n.read_at IS NULL
      AND (n.expires_at IS NULL OR n.expires_at > now());
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
