-- Drop vestigial per-student rate columns.
--
-- students.hourly_rate / students.subject_rates were added in
-- 20260102000010_student_hourly_rates.sql for invoice calculation, but billing
-- now reads rates exclusively from tutor_settings (subject_rates / default_rate).
-- These columns are never written by the app (no UI sets them) and were only
-- read in one place (usePayments.ts), where only student.name was used. No
-- function, view, or trigger references them. Removing them to match reality.

ALTER TABLE students DROP COLUMN IF EXISTS hourly_rate;
ALTER TABLE students DROP COLUMN IF EXISTS subject_rates;
