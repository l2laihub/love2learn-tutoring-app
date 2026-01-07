-- Fix duplicate notifications for combined lesson reschedule requests (v3)
-- New approach: Skip trigger-based notifications for combined sessions (request_group_id IS NOT NULL)
-- The application will create the notification after all requests are inserted

-- Drop the existing triggers
DROP TRIGGER IF EXISTS trigger_notify_reschedule_request ON lesson_requests;
DROP TRIGGER IF EXISTS trigger_notify_reschedule_response ON lesson_requests;

-- Create a new function that ONLY handles single-student requests
-- Combined sessions (with request_group_id) will be handled by the application
CREATE OR REPLACE FUNCTION notify_on_reschedule_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_name TEXT;
  v_parent_name TEXT;
  v_tutor_id UUID;
BEGIN
  -- Skip if this is part of a combined session - app will handle notification
  IF NEW.request_group_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get student and parent names
  SELECT s.name INTO v_student_name
  FROM students s
  WHERE s.id = NEW.student_id;

  SELECT name INTO v_parent_name
  FROM parents
  WHERE id = NEW.parent_id;

  -- Get the tutor's parent record ID (role = 'tutor')
  SELECT id INTO v_tutor_id
  FROM parents
  WHERE role = 'tutor'
  LIMIT 1;

  -- Create notification for tutor (single student only)
  IF v_tutor_id IS NOT NULL THEN
    PERFORM create_notification(
      v_tutor_id,
      NEW.parent_id,
      'reschedule_request'::notification_type,
      'New Reschedule Request',
      v_parent_name || ' requested to reschedule ' || v_student_name || '''s lesson to ' || to_char(NEW.preferred_date::date, 'Mon DD, YYYY'),
      jsonb_build_object(
        'request_id', NEW.id,
        'student_id', NEW.student_id,
        'student_name', v_student_name,
        'parent_name', v_parent_name,
        'preferred_date', NEW.preferred_date,
        'preferred_time', NEW.preferred_time
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

-- Response notification - same approach: skip combined sessions
CREATE OR REPLACE FUNCTION notify_on_reschedule_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_name TEXT;
  v_status_text TEXT;
  v_title TEXT;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only notify on approved/rejected/scheduled
  IF NEW.status NOT IN ('approved', 'rejected', 'scheduled') THEN
    RETURN NEW;
  END IF;

  -- Skip if this is part of a combined session - app will handle notification
  IF NEW.request_group_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get student name
  SELECT name INTO v_student_name
  FROM students
  WHERE id = NEW.student_id;

  -- Set status text
  CASE NEW.status
    WHEN 'approved' THEN v_status_text := 'approved';
    WHEN 'scheduled' THEN v_status_text := 'approved and scheduled';
    WHEN 'rejected' THEN v_status_text := 'declined';
  END CASE;

  v_title := 'Reschedule Request ' || initcap(NEW.status);

  -- Create notification for parent (single student only)
  PERFORM create_notification(
    NEW.parent_id,
    NULL,  -- System notification
    'reschedule_response'::notification_type,
    v_title,
    'Your reschedule request for ' || v_student_name || '''s lesson has been ' || v_status_text || '.' ||
    CASE WHEN NEW.tutor_response IS NOT NULL THEN ' Message: ' || NEW.tutor_response ELSE '' END,
    jsonb_build_object(
      'request_id', NEW.id,
      'student_id', NEW.student_id,
      'student_name', v_student_name,
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

-- Create a function for the app to call after creating combined session requests
-- This creates a single notification for all students in the group
CREATE OR REPLACE FUNCTION create_combined_reschedule_notification(
  p_request_group_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_names TEXT;
  v_parent_name TEXT;
  v_parent_id UUID;
  v_tutor_id UUID;
  v_preferred_date DATE;
  v_preferred_time TIME;
  v_first_request_id UUID;
  v_notification_id UUID;
BEGIN
  -- Get info from the first request in the group
  SELECT
    lr.id,
    lr.parent_id,
    lr.preferred_date,
    lr.preferred_time,
    p.name
  INTO
    v_first_request_id,
    v_parent_id,
    v_preferred_date,
    v_preferred_time,
    v_parent_name
  FROM lesson_requests lr
  JOIN parents p ON lr.parent_id = p.id
  WHERE lr.request_group_id = p_request_group_id
  ORDER BY lr.id
  LIMIT 1;

  IF v_first_request_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get all student names for this group
  SELECT string_agg(s.name, ' & ' ORDER BY s.name) INTO v_student_names
  FROM lesson_requests lr
  JOIN students s ON lr.student_id = s.id
  WHERE lr.request_group_id = p_request_group_id;

  -- Get the tutor's parent record ID
  SELECT id INTO v_tutor_id
  FROM parents
  WHERE role = 'tutor'
  LIMIT 1;

  -- Create a single notification for the tutor
  IF v_tutor_id IS NOT NULL THEN
    v_notification_id := create_notification(
      v_tutor_id,
      v_parent_id,
      'reschedule_request'::notification_type,
      'New Reschedule Request',
      v_parent_name || ' requested to reschedule ' || v_student_names || '''s lesson to ' || to_char(v_preferred_date, 'Mon DD, YYYY'),
      jsonb_build_object(
        'request_id', v_first_request_id,
        'request_group_id', p_request_group_id,
        'student_names', v_student_names,
        'parent_name', v_parent_name,
        'preferred_date', v_preferred_date,
        'preferred_time', v_preferred_time
      ),
      'high'::notification_priority,
      '/requests'
    );
  END IF;

  RETURN v_notification_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_combined_reschedule_notification TO authenticated;
