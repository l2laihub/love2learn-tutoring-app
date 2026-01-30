-- Fix payment_lessons amounts after lesson duration corrections
--
-- Issue: The payment_lessons table has amounts calculated from OLD (incorrect) lesson durations.
-- After fixing the lesson durations, we need to recalculate the payment amounts.
--
-- For Rose (Hong) Tang's January 2026 invoice:
-- - Jan 8: $40 (was correct)
-- - Jan 15: $20 → $40 (60min at $40/hr)
-- - Jan 22: $20 → $40 (60min at $40/hr)
-- - Jan 29: $20 → $40 (60min at $40/hr)
-- Total: $100 → $160

-- Step 1: Update payment_lessons amounts based on corrected lesson durations
-- Using the formula: amount = (duration_min / 60) * hourly_rate
-- Assuming $40/hr for math lessons (this is the standard rate)
UPDATE payment_lessons pl
SET amount = (sl.duration_min::decimal / 60.0) * 40.0
FROM scheduled_lessons sl
WHERE pl.lesson_id = sl.id
  AND sl.subject = 'math'
  AND pl.amount < (sl.duration_min::decimal / 60.0) * 40.0;  -- Only fix if amount is less than expected

-- Step 2: Recalculate payments.amount_due from payment_lessons
UPDATE payments p
SET amount_due = subq.total_amount
FROM (
  SELECT
    payment_id,
    SUM(amount) as total_amount
  FROM payment_lessons
  GROUP BY payment_id
) subq
WHERE p.id = subq.payment_id
  AND p.amount_due != subq.total_amount;

-- Step 3: Specifically fix Rose (Hong) Tang's January payment if not caught by above
-- Parent ID: fdc02819-91d0-4b43-944b-50533f06d966
-- The corrected lesson amounts should be $40 each for 4 lessons = $160
UPDATE payment_lessons pl
SET amount = 40.00
FROM scheduled_lessons sl
JOIN students s ON s.id = sl.student_id
WHERE pl.lesson_id = sl.id
  AND s.parent_id = 'fdc02819-91d0-4b43-944b-50533f06d966'
  AND sl.duration_min = 60
  AND sl.subject = 'math'
  AND pl.amount < 40.00;

-- Step 4: Update the payment total for Rose (Hong) Tang
UPDATE payments
SET amount_due = (
  SELECT SUM(amount)
  FROM payment_lessons
  WHERE payment_id = payments.id
)
WHERE parent_id = 'fdc02819-91d0-4b43-944b-50533f06d966'
  AND month = '2026-01-01';
