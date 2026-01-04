-- Add override_amount column to scheduled_lessons table
-- This allows manual price overrides for edge cases where the calculated rate
-- doesn't apply (e.g., special discounts, promotional rates, makeup sessions)

ALTER TABLE public.scheduled_lessons
ADD COLUMN override_amount DECIMAL(10, 2) DEFAULT NULL;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN public.scheduled_lessons.override_amount IS
  'Optional manual override for lesson price. When set, this amount is used instead of the calculated rate based on subject/duration.';
