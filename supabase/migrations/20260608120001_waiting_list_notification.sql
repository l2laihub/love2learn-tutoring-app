-- Migration: Waiting List notification trigger
-- Version: 20260608120001
-- Description: On a new waiting_list row, notify the owning tutor.
--   Reuses the existing 'general' notification_type (no enum change).

CREATE OR REPLACE FUNCTION notify_on_waiting_list_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        tutor_id
    ) VALUES (
        NEW.tutor_id,
        NULL,
        'general'::notification_type,
        'New Waiting List Inquiry',
        COALESCE(NEW.parent_name, 'Someone') || ' submitted an inquiry',
        jsonb_build_object(
            'waiting_list_id', NEW.id,
            'parent_name', NEW.parent_name,
            'student_name', NEW.student_name,
            'subjects', NEW.subjects
        ),
        'normal',
        '/waiting-list',
        NEW.tutor_id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS waiting_list_notify_insert ON waiting_list;
CREATE TRIGGER waiting_list_notify_insert
    AFTER INSERT ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_waiting_list_insert();
