-- Migration: Fix subscription schema so the paywall can actually work
-- Version: 20260610000001
-- Description:
--   The subscription system (src/lib/stripe.ts, useSubscription, stripe-webhook)
--   was wired against a schema that never fully landed. Three mismatches made it
--   impossible for any tutor to be seen as subscribed:
--
--     1. `subscription_plan` is SELECTed by useSubscription and written by the
--        stripe-webhook edge function, but the column was never created. The
--        SELECT errors ("column does not exist") and the webhook UPDATE fails.
--     2. `subscription_status` allowed only ('trial', ...) but the app and Stripe
--        use 'trialing'. The webhook's UPDATE therefore violates the CHECK
--        constraint and the status never syncs.
--     3. is_subscription_active() checks for 'trial' instead of 'trialing'.
--
--   This migration adds the missing column and normalizes the status values to
--   match src/lib/stripe.ts `SubscriptionStatus`.

-- ============================================================================
-- 1. ADD subscription_plan
-- ============================================================================
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT
  CHECK (subscription_plan IS NULL OR subscription_plan IN ('solo', 'pro'));

COMMENT ON COLUMN parents.subscription_plan IS 'Active subscription plan tier: solo or pro (NULL until a plan is chosen)';

-- ============================================================================
-- 2. NORMALIZE subscription_status ('trial' -> 'trialing')
-- ============================================================================
-- Drop the old constraint that only permitted 'trial'.
ALTER TABLE parents DROP CONSTRAINT IF EXISTS parents_subscription_status_check;

-- Migrate any legacy rows to the value the app + Stripe use.
UPDATE parents SET subscription_status = 'trialing' WHERE subscription_status = 'trial';

-- New default + constraint aligned with src/lib/stripe.ts SubscriptionStatus.
ALTER TABLE parents ALTER COLUMN subscription_status SET DEFAULT 'trialing';

ALTER TABLE parents
  ADD CONSTRAINT parents_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired'));

-- ============================================================================
-- 3. UPDATE is_subscription_active() to match normalized values
-- ============================================================================
CREATE OR REPLACE FUNCTION is_subscription_active(p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
BEGIN
  SELECT subscription_status, trial_ends_at, subscription_ends_at
  INTO v_parent
  FROM parents
  WHERE id = p_tutor_id AND role = 'tutor';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- In trial and the trial has not yet ended.
  IF v_parent.subscription_status = 'trialing'
     AND v_parent.trial_ends_at IS NOT NULL
     AND v_parent.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Paid and active, with the period still open (or open-ended).
  IF v_parent.subscription_status = 'active' THEN
    IF v_parent.subscription_ends_at IS NULL OR v_parent.subscription_ends_at > NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_subscription_active(UUID) IS 'Returns true if the tutor has an active paid subscription or is within an unexpired trial period';
