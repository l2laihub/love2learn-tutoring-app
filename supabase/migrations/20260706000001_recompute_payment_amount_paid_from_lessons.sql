-- Migration: Keep payments.amount_paid / status in sync with the lesson checklist
-- Version: 20260706000001
--
-- Problem: when a payment has linked lessons (payment_lessons), the per-lesson `paid`
-- checklist is the source of truth for how much is paid, but payments.amount_paid and
-- payments.status were only updated by manual edits. Appending newly-completed lessons
-- (auto-complete / quick-invoice) bumped amount_due but left amount_paid alone, so a
-- payment could read "paid / $0 outstanding" on the Payment Tracking list while completed
-- lessons sat unpaid in the checklist.
--
-- Fix: whenever a payment_lessons row is inserted, its paid/amount changes, or it is
-- deleted, recompute the parent payment's amount_paid = SUM(amount) of paid lessons and
-- derive status. This makes every screen that reads payments.amount_paid/status correct
-- without per-screen logic. Payments with NO linked lessons (manual, prepaid) never fire
-- the trigger and keep their manually-entered amounts.

-- ============================================================================
-- RECOMPUTE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION recompute_payment_from_lessons()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_payment_id UUID;
  paid_sum NUMERIC;
  due NUMERIC;
  new_status payment_status;
BEGIN
  -- Only respond to direct changes on payment_lessons. When the existing
  -- payments -> lessons trigger (sync_payment_lessons_paid_status) marks lessons
  -- paid it does so at trigger depth > 1; skipping those breaks the ping-pong.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  target_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);

  SELECT amount_due INTO due FROM payments WHERE id = target_payment_id;
  IF NOT FOUND THEN
    RETURN NULL; -- payment row already gone (cascade delete)
  END IF;

  SELECT COALESCE(SUM(amount) FILTER (WHERE paid), 0)
    INTO paid_sum
  FROM payment_lessons
  WHERE payment_id = target_payment_id;

  IF paid_sum >= due THEN
    new_status := 'paid';
  ELSIF paid_sum > 0 THEN
    new_status := 'partial';
  ELSE
    new_status := 'unpaid';
  END IF;

  UPDATE payments
  SET amount_paid = paid_sum,
      status = new_status,
      paid_at = CASE WHEN new_status = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END
  WHERE id = target_payment_id
    AND (amount_paid IS DISTINCT FROM paid_sum OR status IS DISTINCT FROM new_status);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recompute_payment_from_lessons ON payment_lessons;

CREATE TRIGGER trigger_recompute_payment_from_lessons
  AFTER INSERT OR DELETE OR UPDATE OF paid, amount ON payment_lessons
  FOR EACH ROW
  EXECUTE FUNCTION recompute_payment_from_lessons();

-- ============================================================================
-- BACKFILL: heal payments whose stored amount_paid drifted from their checklist
-- (only payments that have linked lessons are touched)
-- ============================================================================

UPDATE payments p
SET amount_paid = sub.paid_sum,
    status = CASE
      WHEN sub.paid_sum >= p.amount_due THEN 'paid'
      WHEN sub.paid_sum > 0 THEN 'partial'
      ELSE 'unpaid'
    END::payment_status,
    paid_at = CASE WHEN sub.paid_sum >= p.amount_due THEN COALESCE(p.paid_at, NOW()) ELSE NULL END
FROM (
  SELECT payment_id, COALESCE(SUM(amount) FILTER (WHERE paid), 0) AS paid_sum
  FROM payment_lessons
  GROUP BY payment_id
) sub
WHERE p.id = sub.payment_id
  AND (
    p.amount_paid IS DISTINCT FROM sub.paid_sum
    OR p.status IS DISTINCT FROM (CASE
      WHEN sub.paid_sum >= p.amount_due THEN 'paid'
      WHEN sub.paid_sum > 0 THEN 'partial'
      ELSE 'unpaid'
    END::payment_status)
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION recompute_payment_from_lessons() IS
  'Recomputes payments.amount_paid (sum of paid payment_lessons) and status whenever the lesson checklist changes. The checklist is the source of truth for payments that have linked lessons.';
