-- Migration: Add paid field to payment_lessons
-- Allows tracking individual lesson payment status for partial payments
-- Version: 20260129000003

-- ============================================================================
-- ADD PAID COLUMN TO PAYMENT_LESSONS
-- ============================================================================

-- Add paid column (defaults to false for new records)
ALTER TABLE payment_lessons
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false NOT NULL;

-- Add index for filtering unpaid lessons efficiently
CREATE INDEX IF NOT EXISTS idx_payment_lessons_paid ON payment_lessons(paid);

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Mark all lessons in fully paid payments as paid
UPDATE payment_lessons pl
SET paid = true
FROM payments p
WHERE pl.payment_id = p.id
AND p.status = 'paid';

-- ============================================================================
-- TRIGGER TO AUTO-MARK LESSONS WHEN PAYMENT IS MARKED PAID
-- ============================================================================

-- Function to auto-mark lessons as paid when payment status changes to 'paid'
CREATE OR REPLACE FUNCTION sync_payment_lessons_paid_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When payment is marked as paid, mark all its lessons as paid
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE payment_lessons
    SET paid = true
    WHERE payment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists (for re-running migration)
DROP TRIGGER IF EXISTS trigger_sync_payment_lessons_paid ON payments;

-- Create trigger on payments table
CREATE TRIGGER trigger_sync_payment_lessons_paid
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_payment_lessons_paid_status();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN payment_lessons.paid IS 'Whether this individual lesson has been paid. Used for partial payments to track which lessons are covered.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After running this migration, verify with:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
-- WHERE table_name = 'payment_lessons' AND column_name = 'paid';
