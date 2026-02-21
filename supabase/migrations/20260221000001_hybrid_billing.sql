-- Hybrid Billing: Per-Subject Prepaid/Invoice Support
-- Allows a family to have both prepaid (per-subject) and invoice payments in the same month

-- 1. Add subject column to payments (nullable, NULL = all subjects / legacy)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS subject TEXT;

-- 2. Add prepaid_subjects JSONB to parents (tracks which subjects use prepaid billing)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS prepaid_subjects JSONB DEFAULT '[]'::jsonb;

-- 3. Drop the old unique constraint that only allows one payment per family per month
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_parent_month_unique;

-- 4. Add new unique constraint: one payment per (parent, month, type, subject)
-- COALESCE handles NULL subject as '__all__' for uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS payments_parent_month_type_subject_unique
  ON payments (parent_id, month, payment_type, COALESCE(subject, '__all__'));

-- 5. Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_payments_parent_month_type_subject
  ON payments (parent_id, month, payment_type, subject);

-- 6. Assign correct subjects to existing prepaid families and their payments.
-- This converts legacy all-subjects prepaid into subject-specific prepaid,
-- so other subjects (e.g., drop-in Math) can be invoiced separately.

-- Hien Dang family: prepaid for Math
UPDATE payments SET subject = 'math'
WHERE payment_type = 'prepaid' AND subject IS NULL
  AND parent_id = (SELECT id FROM parents WHERE name ILIKE '%Hien Dang%' LIMIT 1);
UPDATE parents SET prepaid_subjects = '["math"]'::jsonb
WHERE name ILIKE '%Hien Dang%' AND billing_mode = 'prepaid';

-- Hoc Elizabeth Do family: prepaid for Piano
UPDATE payments SET subject = 'piano'
WHERE payment_type = 'prepaid' AND subject IS NULL
  AND parent_id = (SELECT id FROM parents WHERE name ILIKE '%Hoc%Do%' LIMIT 1);
UPDATE parents SET prepaid_subjects = '["piano"]'::jsonb
WHERE name ILIKE '%Hoc%Do%' AND billing_mode = 'prepaid';

-- Johnny Phoi Pak (Chloe Pak) family: prepaid for Piano
UPDATE payments SET subject = 'piano'
WHERE payment_type = 'prepaid' AND subject IS NULL
  AND parent_id = (SELECT id FROM parents WHERE name ILIKE '%Pak%' LIMIT 1);
UPDATE parents SET prepaid_subjects = '["piano"]'::jsonb
WHERE name ILIKE '%Pak%' AND billing_mode = 'prepaid';

-- 7. Update the set_payment_tutor_id trigger function to handle the new schema
-- The existing trigger sets tutor_id on payment insert; no changes needed
-- since the subject column doesn't affect tutor_id assignment
