-- Notifications system for Love2Learn
-- Supports announcements (broadcast), individual notifications, and real-time updates

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'announcement',           -- Broadcast to all parents
  'reschedule_request',     -- Parent requested reschedule (notify tutor)
  'reschedule_response',    -- Tutor responded to reschedule (notify parent)
  'lesson_reminder',        -- Upcoming lesson reminder
  'worksheet_assigned',     -- New worksheet assigned
  'payment_due',            -- Payment reminder
  'general'                 -- General notification
);

-- Create priority enum
CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient: NULL means broadcast to all parents
  recipient_id UUID REFERENCES parents(id) ON DELETE CASCADE,

  -- Sender: the tutor/admin who sent it (NULL for system notifications)
  sender_id UUID REFERENCES parents(id) ON DELETE SET NULL,

  -- Notification content
  type notification_type NOT NULL DEFAULT 'general',
  priority notification_priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Optional metadata (lesson_id, request_id, etc.)
  data JSONB DEFAULT '{}',

  -- Action URL - where to navigate when clicked
  action_url TEXT,

  -- Read status
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ  -- Optional expiration for time-sensitive notifications
);

-- Create notification_reads table for tracking broadcast reads per user
-- This is needed because announcements (recipient_id = NULL) need per-user read tracking
CREATE TABLE notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Each parent can only have one read record per notification
  UNIQUE(notification_id, parent_id)
);

-- Indexes for performance
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notification_reads_parent ON notification_reads(parent_id);
CREATE INDEX idx_notification_reads_notification ON notification_reads(notification_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications

-- Tutors can view all notifications
CREATE POLICY "Tutors can view all notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (is_tutor());

-- Parents can view notifications sent to them or announcements (recipient_id IS NULL)
CREATE POLICY "Parents can view their notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND (
      recipient_id = get_parent_id() OR
      recipient_id IS NULL
    )
  );

-- Tutors can create notifications
CREATE POLICY "Tutors can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tutor());

-- Tutors can update any notification
CREATE POLICY "Tutors can update notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (is_tutor());

-- Parents can mark their own notifications as read
CREATE POLICY "Parents can mark notifications read"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    NOT is_tutor() AND
    recipient_id = get_parent_id()
  )
  WITH CHECK (
    NOT is_tutor() AND
    recipient_id = get_parent_id()
  );

-- Tutors can delete notifications
CREATE POLICY "Tutors can delete notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (is_tutor());

-- RLS Policies for notification_reads

-- Users can view their own read records
CREATE POLICY "Users can view their read records"
  ON notification_reads
  FOR SELECT
  TO authenticated
  USING (parent_id = get_parent_id() OR is_tutor());

-- Users can create their own read records
CREATE POLICY "Users can create read records"
  ON notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (parent_id = get_parent_id());

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,  -- NULL for broadcast
  p_sender_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_priority notification_priority DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    sender_id,
    type,
    title,
    message,
    data,
    priority,
    action_url,
    expires_at
  ) VALUES (
    p_recipient_id,
    p_sender_id,
    p_type,
    p_title,
    p_message,
    p_data,
    p_priority,
    p_action_url,
    p_expires_at
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Function to send announcement to all parents
CREATE OR REPLACE FUNCTION send_announcement(
  p_sender_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_priority notification_priority DEFAULT 'normal',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN create_notification(
    NULL,  -- NULL recipient means broadcast
    p_sender_id,
    'announcement'::notification_type,
    p_title,
    p_message,
    '{}',
    p_priority,
    NULL,
    p_expires_at
  );
END;
$$;

-- Function to get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_direct_count INTEGER;
  v_broadcast_count INTEGER;
BEGIN
  -- Count direct notifications that are unread
  SELECT COUNT(*)
  INTO v_direct_count
  FROM notifications
  WHERE recipient_id = p_parent_id
    AND read_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  -- Count broadcast notifications that haven't been read by this user
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

  RETURN v_direct_count + v_broadcast_count;
END;
$$;

-- Function to mark notification as read (handles both direct and broadcast)
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_parent_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification RECORD;
BEGIN
  SELECT * INTO v_notification
  FROM notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- If it's a direct notification, update read_at
  IF v_notification.recipient_id IS NOT NULL THEN
    IF v_notification.recipient_id != p_parent_id THEN
      RETURN FALSE;  -- Can't mark someone else's notification as read
    END IF;

    UPDATE notifications
    SET read_at = now()
    WHERE id = p_notification_id
      AND read_at IS NULL;
  ELSE
    -- It's a broadcast, insert into notification_reads
    INSERT INTO notification_reads (notification_id, parent_id)
    VALUES (p_notification_id, p_parent_id)
    ON CONFLICT (notification_id, parent_id) DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$;

-- Trigger function to auto-create notification when reschedule request is created
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
  -- Get student and parent info
  SELECT s.name, p.name INTO v_student_name, v_parent_name
  FROM students s
  JOIN parents p ON s.parent_id = p.id
  WHERE s.id = NEW.student_id;

  -- Get the tutor's parent record ID (role = 'tutor')
  SELECT id INTO v_tutor_id
  FROM parents
  WHERE role = 'tutor'
  LIMIT 1;

  -- Create notification for tutor
  IF v_tutor_id IS NOT NULL THEN
    PERFORM create_notification(
      v_tutor_id,
      NEW.parent_id,
      'reschedule_request'::notification_type,
      'New Reschedule Request',
      v_parent_name || ' requested to reschedule ' || v_student_name || '''s ' || NEW.subject || ' lesson to ' || to_char(NEW.preferred_date::date, 'Mon DD, YYYY'),
      jsonb_build_object(
        'request_id', NEW.id,
        'student_id', NEW.student_id,
        'student_name', v_student_name,
        'parent_name', v_parent_name,
        'subject', NEW.subject,
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

-- Create trigger for reschedule request notifications
CREATE TRIGGER trigger_notify_reschedule_request
  AFTER INSERT ON lesson_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reschedule_request();

-- Trigger function to notify parent when reschedule is responded to
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

  -- Create notification for parent
  PERFORM create_notification(
    NEW.parent_id,
    NULL,  -- System notification
    'reschedule_response'::notification_type,
    v_title,
    'Your reschedule request for ' || v_student_name || '''s ' || NEW.subject || ' lesson has been ' || v_status_text || '.' ||
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

-- Create trigger for reschedule response notifications
CREATE TRIGGER trigger_notify_reschedule_response
  AFTER UPDATE ON lesson_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reschedule_response();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION send_announcement TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
