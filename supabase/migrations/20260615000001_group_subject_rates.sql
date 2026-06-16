-- Migration: per-topic group lesson pricing
-- Adds group_subject_rates (mirrors subject_rates shape) and removes the unused
-- flat combined_session_rate column (it was never applied to billing).

ALTER TABLE tutor_settings
    ADD COLUMN IF NOT EXISTS group_subject_rates JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tutor_settings.group_subject_rates IS
    'Per-subject group/combined-session rates, same shape as subject_rates: {"piano": {"rate": 25, "base_duration": 30, "duration_prices": {"30": 25}}}';

ALTER TABLE tutor_settings
    DROP COLUMN IF EXISTS combined_session_rate;
