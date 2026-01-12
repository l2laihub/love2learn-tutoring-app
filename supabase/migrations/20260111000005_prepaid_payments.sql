-- Migration: Prepaid Monthly Payments
-- This migration adds support for prepaid monthly payment tracking
-- Parents can optionally prepay for sessions ahead of time

-- ============================================================================
-- 1. Add billing_mode to parents table
-- ============================================================================
-- This allows different families to have different billing preferences
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'invoice'
CHECK (billing_mode IN ('invoice', 'prepaid'));

COMMENT ON COLUMN parents.billing_mode IS
'Billing mode for this family: invoice (pay after lessons) or prepaid (pay ahead for sessions)';

-- ============================================================================
-- 2. Add prepaid tracking fields to payments table
-- ============================================================================
-- Extend payments to support prepaid session tracking
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'invoice'
CHECK (payment_type IN ('invoice', 'prepaid'));

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS sessions_prepaid INTEGER DEFAULT 0;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS sessions_used INTEGER DEFAULT 0;

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS sessions_rolled_over INTEGER DEFAULT 0;

COMMENT ON COLUMN payments.payment_type IS
'Type of payment: invoice (standard billing) or prepaid (advance payment for sessions)';

COMMENT ON COLUMN payments.sessions_prepaid IS
'Total number of sessions covered by this prepayment (includes rolled over sessions)';

COMMENT ON COLUMN payments.sessions_used IS
'Number of sessions that have been consumed from this prepayment';

COMMENT ON COLUMN payments.sessions_rolled_over IS
'Number of unused sessions rolled over from the previous month';

-- ============================================================================
-- 3. Create function to get previous month's unused sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION get_rollover_sessions(
  p_parent_id UUID,
  p_current_month DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_previous_month DATE;
  v_rollover INTEGER;
BEGIN
  -- Calculate previous month
  v_previous_month := (p_current_month - INTERVAL '1 month')::DATE;
  v_previous_month := DATE_TRUNC('month', v_previous_month)::DATE;

  -- Get unused sessions from previous month's prepaid payment
  SELECT COALESCE(sessions_prepaid - sessions_used, 0)
  INTO v_rollover
  FROM payments
  WHERE parent_id = p_parent_id
    AND month = v_previous_month
    AND payment_type = 'prepaid'
  LIMIT 1;

  RETURN COALESCE(v_rollover, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Create function to increment session usage
-- ============================================================================
-- Called when a lesson is marked as completed for a prepaid family
CREATE OR REPLACE FUNCTION increment_prepaid_session_usage(
  p_parent_id UUID,
  p_month DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment_id UUID;
  v_sessions_prepaid INTEGER;
  v_sessions_used INTEGER;
BEGIN
  -- Find the prepaid payment for this month
  SELECT id, sessions_prepaid, sessions_used
  INTO v_payment_id, v_sessions_prepaid, v_sessions_used
  FROM payments
  WHERE parent_id = p_parent_id
    AND month = DATE_TRUNC('month', p_month)::DATE
    AND payment_type = 'prepaid'
  LIMIT 1;

  -- If no prepaid payment exists, return false (use invoice mode)
  IF v_payment_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Increment sessions_used
  UPDATE payments
  SET sessions_used = sessions_used + 1,
      updated_at = NOW()
  WHERE id = v_payment_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Create function to decrement session usage (for uncompleting lessons)
-- ============================================================================
CREATE OR REPLACE FUNCTION decrement_prepaid_session_usage(
  p_parent_id UUID,
  p_month DATE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_payment_id UUID;
  v_sessions_used INTEGER;
BEGIN
  -- Find the prepaid payment for this month
  SELECT id, sessions_used
  INTO v_payment_id, v_sessions_used
  FROM payments
  WHERE parent_id = p_parent_id
    AND month = DATE_TRUNC('month', p_month)::DATE
    AND payment_type = 'prepaid'
  LIMIT 1;

  -- If no prepaid payment exists, return false
  IF v_payment_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only decrement if sessions_used > 0
  IF v_sessions_used > 0 THEN
    UPDATE payments
    SET sessions_used = sessions_used - 1,
        updated_at = NOW()
    WHERE id = v_payment_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Create view for prepaid status summary
-- ============================================================================
CREATE OR REPLACE VIEW prepaid_status_summary AS
SELECT
  p.id AS payment_id,
  p.parent_id,
  pa.name AS parent_name,
  pa.billing_mode,
  p.month,
  p.payment_type,
  p.status,
  p.amount_due,
  p.amount_paid,
  p.sessions_prepaid,
  p.sessions_used,
  p.sessions_rolled_over,
  (p.sessions_prepaid - p.sessions_used) AS sessions_remaining,
  CASE
    WHEN p.sessions_prepaid > 0
    THEN ROUND((p.sessions_used::NUMERIC / p.sessions_prepaid::NUMERIC) * 100, 1)
    ELSE 0
  END AS usage_percentage
FROM payments p
JOIN parents pa ON p.parent_id = pa.id
WHERE p.payment_type = 'prepaid';

-- Grant access to the view
GRANT SELECT ON prepaid_status_summary TO authenticated;

-- ============================================================================
-- 7. Add index for efficient prepaid queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payments_prepaid
ON payments (parent_id, month, payment_type)
WHERE payment_type = 'prepaid';

CREATE INDEX IF NOT EXISTS idx_parents_billing_mode
ON parents (billing_mode);

-- ============================================================================
-- 8. RLS policies for new columns (inherit existing payment policies)
-- ============================================================================
-- The existing RLS policies on payments table will automatically apply
-- to the new columns. No additional policies needed.

-- ============================================================================
-- Done! Migration complete.
-- ============================================================================
