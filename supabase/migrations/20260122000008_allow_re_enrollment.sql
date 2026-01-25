-- Migration: Allow re-enrollment after rejection
-- Version: 20260122000008
-- Description: Adds RLS policy to allow parents to re-submit enrollment requests
--              after being rejected or cancelled. The existing policy only allowed
--              cancelling pending enrollments.

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Parents can cancel own pending enrollments" ON public.session_enrollments;

-- Create new policy that allows:
-- 1. Cancelling pending enrollments (status: pending -> cancelled)
-- 2. Re-submitting rejected/cancelled enrollments (status: rejected/cancelled -> pending)
CREATE POLICY "Parents can update own enrollments"
  ON public.session_enrollments
  FOR UPDATE
  TO authenticated
  USING (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    AND status IN ('pending', 'rejected', 'cancelled')
  )
  WITH CHECK (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    AND status IN ('pending', 'cancelled')  -- Can only set to pending or cancelled
  );

COMMENT ON POLICY "Parents can update own enrollments" ON public.session_enrollments IS
  'Allows parents to cancel pending enrollments or re-submit rejected/cancelled enrollments';
