-- Migration: Allow parents to create notification requests
-- Version: 20260122000006
-- Description: Adds RLS policy allowing parents to insert broadcast notifications
--              for request types (enrollment_request, reschedule_request, dropin_request).
--              Previously only tutors could insert notifications, which silently blocked
--              parent requests from appearing in tutor notifications.

-- Add policy for parents to create request notifications (broadcast to tutors)
CREATE POLICY "Parents can create request notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be sending as themselves (use subquery to get scalar value)
    sender_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    -- Must be a broadcast notification (recipient_id IS NULL) for tutors to see
    AND recipient_id IS NULL
    -- Only allow request types that parents should create
    AND type IN ('enrollment_request', 'reschedule_request', 'dropin_request')
  );
