-- Migration: Add subscription and business fields to parents table
-- Version: 20260201000001
-- Description: Adds multi-tutor SaaS support fields for subscription management
--
-- This migration adds fields to support:
-- - Business branding (business_name)
-- - Timezone preferences
-- - Subscription status and billing
-- - Stripe integration
-- - Trial period tracking

-- ============================================================================
-- ADD SUBSCRIPTION AND BUSINESS COLUMNS TO PARENTS TABLE
-- ============================================================================

-- Business name for tutor branding
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS business_name TEXT;

COMMENT ON COLUMN parents.business_name IS 'Business name for tutor branding, displayed to parents';

-- Timezone for scheduling and display
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

COMMENT ON COLUMN parents.timezone IS 'User timezone for scheduling and time display (IANA timezone format)';

-- Subscription status enum-like constraint
-- Values: trial, active, past_due, cancelled, expired
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'expired'));

COMMENT ON COLUMN parents.subscription_status IS 'Current subscription status: trial, active, past_due, cancelled, expired';

-- Subscription end date (for billing cycle)
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN parents.subscription_ends_at IS 'Timestamp when current subscription period ends';

-- Stripe integration fields
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN parents.stripe_customer_id IS 'Stripe Customer ID for payment processing';

ALTER TABLE parents
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN parents.stripe_subscription_id IS 'Stripe Subscription ID for recurring billing';

-- Trial period end date (defaults to 14 days from creation for new tutors)
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

COMMENT ON COLUMN parents.trial_ends_at IS 'Timestamp when free trial period ends for tutors';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on subscription_status for tutors (common query for subscription management)
CREATE INDEX IF NOT EXISTS idx_parents_subscription_status
ON parents(subscription_status)
WHERE role = 'tutor';

-- Index on stripe_customer_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_parents_stripe_customer_id
ON parents(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Index on stripe_subscription_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_parents_stripe_subscription_id
ON parents(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a tutor has an active subscription
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

  -- Check if in trial period
  IF v_parent.subscription_status = 'trial' AND v_parent.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Check if subscription is active and not expired
  IF v_parent.subscription_status = 'active' THEN
    IF v_parent.subscription_ends_at IS NULL OR v_parent.subscription_ends_at > NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_subscription_active(UUID) IS 'Returns true if the tutor has an active subscription or is within trial period';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_subscription_active(UUID) TO authenticated;
