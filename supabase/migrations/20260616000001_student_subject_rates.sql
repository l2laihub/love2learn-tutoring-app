-- Per-student, per-subject rate overrides.
--
-- Re-introduces students.subject_rates (dropped in
-- 20260614000001_drop_vestigial_student_rates.sql as vestigial). This time it
-- is written by the student detail screen and read by billing. Shape mirrors
-- tutor_settings.subject_rates: { "<subject>": { rate, base_duration,
-- duration_prices? } }. An empty object means "use the tutor-wide rate".
--
-- A student rate, when present and valid (rate > 0 && base_duration > 0), wins
-- over group_subject_rates and subject_rates for that student's lessons
-- (solo or combined). The per-lesson override_amount still takes precedence.
--
-- hourly_rate is intentionally NOT re-added; only per-subject configs are used.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS subject_rates JSONB NOT NULL DEFAULT '{}'::jsonb;
