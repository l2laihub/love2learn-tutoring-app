-- Simplify reschedule notifications
-- One notification per reschedule submission, regardless of combined sessions
-- For combined sessions, only the first request (with request_group_id) triggers notification

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_notify_reschedule_request ON lesson_requests;
DROP TRIGGER IF EXISTS trigger_notify_reschedule_response ON lesson_requests;

-- Simple notification for reschedule requests
CREATE OR REPLACE FUNCTION notify_on_reschedule_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_name TEXT;
  v_tutor_id UUID;
  v_existing_notification INTEGER;
BEGIN
  -- For combined sessions (request_group_id is set), only create notification for the first one
  IF NEW.request_group_id IS NOT NULL THEN
    -- Check if we already created a notification for this group
    SELECT COUNT(*) INTO v_existing_notification
    FROM notifications
    WHERE data->>'request_group_id' = NEW.request_group_id::text
      AND type = 'reschedule_request';

    IF v_existing_notification > 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get parent name
  SELECT name INTO v_parent_name
  FROM parents
  WHERE id = NEW.parent_id;

  -- Get the tutor's parent record ID (role = 'tutor')
  SELECT id INTO v_tutor_id
  FROM parents
  WHERE role = 'tutor'
  LIMIT 1;

  -- Create simple notification for tutor
  IF v_tutor_id IS NOT NULL THEN
    PERFORM create_notification(
      v_tutor_id,
      NEW.parent_id,
      'reschedule_request'::notification_type,
      'New Reschedule Request',
      v_parent_name || ' submitted a reschedule request for ' || to_char(NEW.preferred_date::date, 'Mon DD, YYYY'),
      jsonb_build_object(
        'request_id', NEW.id,
        'request_group_id', NEW.request_group_id,
        'parent_name', v_parent_name,
        'preferred_date', NEW.preferred_date
      ),
      'high'::notification_priority,
      '/requests'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_notify_reschedule_request
  AFTER INSERT ON lesson_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reschedule_request();

-- Simple notification for reschedule responses
CREATE OR REPLACE FUNCTION notify_on_reschedule_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_text TEXT;
  v_title TEXT;
  v_existing_notification INTEGER;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only notify on approved/rejected/scheduled
  IF NEW.status NOT IN ('approved', 'rejected', 'scheduled') THEN
    RETURN NEW;
  END IF;

  -- For combined sessions, only create notification for the first response
  IF NEW.request_group_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_existing_notification
    FROM notifications
    WHERE data->>'request_group_id' = NEW.request_group_id::text
      AND type = 'reschedule_response'
      AND data->>'status' = NEW.status::text;

    IF v_existing_notification > 0 THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Set status text
  CASE NEW.status
    WHEN 'approved' THEN v_status_text := 'approved';
    WHEN 'scheduled' THEN v_status_text := 'approved and scheduled';
    WHEN 'rejected' THEN v_status_text := 'declined';
  END CASE;

  v_title := 'Reschedule Request ' || initcap(NEW.status);

  -- Create simple notification for parent
  PERFORM create_notification(
    NEW.parent_id,
    NULL,
    'reschedule_response'::notification_type,
    v_title,
    'Your reschedule request has been ' || v_status_text || '.' ||
    CASE WHEN NEW.tutor_response IS NOT NULL THEN ' Message: ' || NEW.tutor_response ELSE '' END,
    jsonb_build_object(
      'request_id', NEW.id,
      'request_group_id', NEW.request_group_id,
      'status', NEW.status,
      'tutor_response', NEW.tutor_response
    ),
    CASE WHEN NEW.status = 'rejected' THEN 'high'::notification_priority ELSE 'normal'::notification_priority END,
    '/calendar'
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_notify_reschedule_response
  AFTER UPDATE ON lesson_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reschedule_response();
