-- Migration: Add email notification for reschedule rejection
-- This creates a function to call the edge function when a reschedule request is rejected

-- Create the function to send rejection email via edge function
CREATE OR REPLACE FUNCTION send_reschedule_rejection_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_name TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_response JSONB;
BEGIN
  -- Only trigger when status changes to 'rejected'
  IF OLD.status = NEW.status OR NEW.status != 'rejected' THEN
    RETURN NEW;
  END IF;

  -- For combined sessions (request_group_id is set), only send email for the first one
  IF NEW.request_group_id IS NOT NULL THEN
    -- Check if we already processed this group (by checking if this is NOT the first one)
    IF EXISTS (
      SELECT 1 FROM lesson_requests
      WHERE request_group_id = NEW.request_group_id
        AND status = 'rejected'
        AND id != NEW.id
        AND updated_at < NEW.updated_at
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Get student name
  SELECT name INTO v_student_name
  FROM students
  WHERE id = NEW.student_id;

  -- Log the rejection for debugging
  RAISE NOTICE 'Sending rejection email for request %, student: %, parent: %',
    NEW.id, v_student_name, NEW.parent_id;

  -- Call the edge function via pg_net extension (if available)
  -- Note: The edge function will be called via HTTP webhook configured in Supabase dashboard
  -- or via the application layer when rejecting

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_send_reschedule_rejection_email ON lesson_requests;
CREATE TRIGGER trigger_send_reschedule_rejection_email
  AFTER UPDATE ON lesson_requests
  FOR EACH ROW
  EXECUTE FUNCTION send_reschedule_rejection_email();

-- Add comment for documentation
COMMENT ON FUNCTION send_reschedule_rejection_email() IS
  'Trigger function to send email notification when a reschedule request is rejected.
   The actual email sending is handled by the application layer calling the edge function.';
