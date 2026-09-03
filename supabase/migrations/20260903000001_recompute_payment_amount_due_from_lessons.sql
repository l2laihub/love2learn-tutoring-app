-- Migration: Keep payments.amount_due in sync with the lesson checklist too
-- Version: 20260903000001
--
-- Problem: for a payment with linked lessons, payment_lessons IS the invoice — the
-- checklist rows carry the per-lesson price. amount_paid has been derived from them
-- since 20260706000001, but amount_due was still maintained by hand-rolled arithmetic
-- in six places: quick invoice and the auto-complete Edge Function add
-- (amount_due + new lessons), lesson cancel / uncomplete and two cancelled-link
-- cleanups subtract (amount_due - link), and the Edit Payment form writes whatever is
-- typed in the field. Every one of those is a read-modify-write on a value that is
-- really a SUM, so a duplicated subtraction (two screens cleaning the same cancelled
-- link), a failed link insert after the amount bump, or a stale typed value leaves
-- amount_due drifting from the links — and nothing ever heals it. Observed in the
-- wild: an invoice reading "$130.00 paid" against "$120.00 due" with three linked
-- lessons of $50 + $40 + $40.
--
-- Fix: amount_due joins amount_paid as a derived column. The same trigger now
-- recomputes amount_due = SUM(payment_lessons.amount) whenever the checklist changes,
-- so the client no longer needs (or is allowed) to do the arithmetic. Payments with NO
-- linked lessons (manual, prepaid) never fire the trigger and keep their entered amount.

-- ============================================================================
-- RECOMPUTE FUNCTION (now covers amount_due as well)
-- ============================================================================

CREATE OR REPLACE FUNCTION recompute_payment_from_lessons()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_payment_id UUID;
  due NUMERIC;
  paid_sum NUMERIC;
  new_status payment_status;
BEGIN
  -- Only respond to direct changes on payment_lessons. When the existing
  -- payments -> lessons trigger (sync_payment_lessons_paid_status) marks lessons
  -- paid it does so at trigger depth > 1; skipping those breaks the ping-pong.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  target_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);

  PERFORM 1 FROM payments WHERE id = target_payment_id;
  IF NOT FOUND THEN
    RETURN NULL; -- payment row already gone (cascade delete)
  END IF;

  SELECT COALESCE(ROUND(SUM(amount), 2), 0),
         COALESCE(ROUND(SUM(amount) FILTER (WHERE paid), 2), 0)
    INTO due, paid_sum
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
  SET amount_due = due,
      amount_paid = paid_sum,
      status = new_status,
      paid_at = CASE WHEN new_status = 'paid' THEN COALESCE(paid_at, NOW()) ELSE NULL END
  WHERE id = target_payment_id
    AND (amount_due IS DISTINCT FROM due
         OR amount_paid IS DISTINCT FROM paid_sum
         OR status IS DISTINCT FROM new_status);

  RETURN NULL;
END;
$$;

-- Trigger definition is unchanged (AFTER INSERT OR DELETE OR UPDATE OF paid, amount),
-- recreated here so the migration is self-contained.
DROP TRIGGER IF EXISTS trigger_recompute_payment_from_lessons ON payment_lessons;

CREATE TRIGGER trigger_recompute_payment_from_lessons
  AFTER INSERT OR DELETE OR UPDATE OF paid, amount ON payment_lessons
  FOR EACH ROW
  EXECUTE FUNCTION recompute_payment_from_lessons();

-- ============================================================================
-- BACKFILL: heal payments whose amount_due drifted from their checklist
-- (only payments that have linked lessons are touched)
-- ============================================================================

UPDATE payments p
SET amount_due = sub.due,
    amount_paid = sub.paid_sum,
    status = CASE
      WHEN sub.paid_sum >= sub.due THEN 'paid'
      WHEN sub.paid_sum > 0 THEN 'partial'
      ELSE 'unpaid'
    END::payment_status,
    paid_at = CASE WHEN sub.paid_sum >= sub.due THEN COALESCE(p.paid_at, NOW()) ELSE NULL END
FROM (
  SELECT payment_id,
         COALESCE(ROUND(SUM(amount), 2), 0) AS due,
         COALESCE(ROUND(SUM(amount) FILTER (WHERE paid), 2), 0) AS paid_sum
  FROM payment_lessons
  GROUP BY payment_id
) sub
WHERE p.id = sub.payment_id
  AND (
    p.amount_due IS DISTINCT FROM sub.due
    OR p.amount_paid IS DISTINCT FROM sub.paid_sum
    OR p.status IS DISTINCT FROM (CASE
      WHEN sub.paid_sum >= sub.due THEN 'paid'
      WHEN sub.paid_sum > 0 THEN 'partial'
      ELSE 'unpaid'
    END::payment_status)
  );

-- ============================================================================
-- CHECK: no lesson-linked payment may disagree with its checklist after this runs
-- ============================================================================

DO $$
DECLARE
  drifted INTEGER;
BEGIN
  SELECT COUNT(*) INTO drifted
  FROM payments p
  JOIN (
    SELECT payment_id,
           COALESCE(ROUND(SUM(amount), 2), 0) AS due,
           COALESCE(ROUND(SUM(amount) FILTER (WHERE paid), 2), 0) AS paid_sum
    FROM payment_lessons
    GROUP BY payment_id
  ) sub ON sub.payment_id = p.id
  WHERE p.amount_due IS DISTINCT FROM sub.due
     OR p.amount_paid IS DISTINCT FROM sub.paid_sum;

  IF drifted > 0 THEN
    RAISE EXCEPTION 'recompute_payment_from_lessons backfill left % payment(s) out of sync with payment_lessons', drifted;
  END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION recompute_payment_from_lessons() IS
  'Recomputes payments.amount_due (sum of linked lessons), amount_paid (sum of the paid ones) and status whenever the lesson checklist changes. payment_lessons is the source of truth for payments that have linked lessons; clients must not do this arithmetic themselves.';
