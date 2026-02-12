-- Migration: Fix reschedule request notifications for multi-tutor
-- Version: 20260210000001
-- Description: Fixes three issues with reschedule request notifications:
--   1. notify_on_reschedule_request trigger uses hardcoded 'WHERE role = tutor LIMIT 1'
--      instead of finding the correct tutor via student's tutor_id
--   2. get_unread_notification_count only counts broadcast 'announcement' type,
--      missing reschedule_request, dropin_request, enrollment_request for tutors
--   3. Tutor read tracking for broadcast notifications uses read_at instead of notification_reads

-- ============================================================================
-- FIX 1: Update notify_on_reschedule_request trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_on_reschedule_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_name TEXT;
  v_parent_name TEXT;
  v_tutor_id UUID;
  v_notification_id UUID;
  v_request_type TEXT;
  v_type_label TEXT;
BEGIN
  -- Get student and parent info, including the student's tutor_id
  SELECT s.name, p.name, s.tutor_id
  INTO v_student_name, v_parent_name, v_tutor_id
  FROM students s
  JOIN parents p ON s.parent_id = p.id
  WHERE s.id = NEW.student_id;

  -- Fallback: if student has no tutor_id, try the parent's tutor_id
  IF v_tutor_id IS NULL THEN
    SELECT p.tutor_id INTO v_tutor_id
    FROM parents p
    WHERE p.id = NEW.parent_id;
  END IF;

  -- Final fallback: find any tutor (for legacy single-tutor setup)
  IF v_tutor_id IS NULL THEN
    SELECT id INTO v_tutor_id
    FROM parents
    WHERE role = 'tutor'
    LIMIT 1;
  END IF;

  -- Determine notification type based on request_type
  v_request_type := COALESCE(NEW.request_type, 'reschedule');

  IF v_request_type = 'dropin' THEN
    v_type_label := 'Drop-in Request';
  ELSE
    v_type_label := 'Reschedule Request';
  END IF;

  -- Create notification for the correct tutor
  IF v_tutor_id IS NOT NULL THEN
    INSERT INTO notifications (
      recipient_id,
      sender_id,
      type,
      title,
      message,
      data,
      priority,
      action_url,
      tutor_id
    ) VALUES (
      v_tutor_id,
      NEW.parent_id,
      CASE v_request_type
        WHEN 'dropin' THEN 'dropin_request'::notification_type
        ELSE 'reschedule_request'::notification_type
      END,
      'New ' || v_type_label,
      v_parent_name || ' requested ' ||
        CASE v_request_type
          WHEN 'dropin' THEN 'a drop-in lesson'
          ELSE 'to reschedule ' || v_student_name || '''s ' || NEW.subject || ' lesson'
        END ||
        ' for ' || to_char(NEW.preferred_date::date, 'Mon DD, YYYY'),
      jsonb_build_object(
        'request_id', NEW.id,
        'student_id', NEW.student_id,
        'student_name', v_student_name,
        'parent_name', v_parent_name,
        'subject', NEW.subject,
        'preferred_date', NEW.preferred_date,
        'preferred_time', NEW.preferred_time,
        'request_type', v_request_type
      ),
      'high'::notification_priority,
      '/requests',
      v_tutor_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- FIX 2: Update get_unread_notification_count for tutors
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_direct_count INTEGER;
  v_broadcast_count INTEGER;
  v_is_tutor BOOLEAN;
  v_tutor_id UUID;
BEGIN
  -- Check if user is a tutor and get their tutor context
  SELECT (role = 'tutor'), CASE WHEN role = 'tutor' THEN id ELSE tutor_id END
  INTO v_is_tutor, v_tutor_id
  FROM parents
  WHERE id = p_parent_id;

  v_is_tutor := COALESCE(v_is_tutor, false);

  -- Count direct notifications that are unread
  SELECT COUNT(*)
  INTO v_direct_count
  FROM notifications
  WHERE recipient_id = p_parent_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  IF v_is_tutor THEN
    -- For tutors: count ALL unread broadcast notifications in their tutor context
    -- Use notification_reads for per-user read tracking (not read_at which is NULL for broadcasts)
    SELECT COUNT(*)
    INTO v_broadcast_count
    FROM notifications n
    WHERE n.recipient_id IS NULL
      AND n.tutor_id = v_tutor_id
      AND (n.expires_at IS NULL OR n.expires_at > now())
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id
          AND nr.parent_id = p_parent_id
      );
  ELSE
    -- For parents: count unread announcements in their tutor context
    SELECT COUNT(*)
    INTO v_broadcast_count
    FROM notifications n
    WHERE n.recipient_id IS NULL
      AND n.type = 'announcement'
      AND n.tutor_id = v_tutor_id
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
