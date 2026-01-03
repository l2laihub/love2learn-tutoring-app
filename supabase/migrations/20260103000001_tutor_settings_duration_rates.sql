-- Migration: Update tutor_settings to support duration-based rates
-- Changes from hourly rate to rate per base duration (e.g., $35 for 30 min, $45 for 60 min)

-- Rename default_hourly_rate to default_rate
ALTER TABLE tutor_settings
RENAME COLUMN default_hourly_rate TO default_rate;

-- Add default_base_duration column (in minutes)
ALTER TABLE tutor_settings
ADD COLUMN default_base_duration INTEGER NOT NULL DEFAULT 60;

-- Update comment for clarity
COMMENT ON COLUMN tutor_settings.default_rate IS 'Default rate amount in dollars';
COMMENT ON COLUMN tutor_settings.default_base_duration IS 'Base duration in minutes for the default rate (e.g., 60 means rate is per hour)';
COMMENT ON COLUMN tutor_settings.subject_rates IS 'JSON object with per-subject rate config: { subject: { rate: number, base_duration: number } }';
COMMENT ON COLUMN tutor_settings.combined_session_rate IS 'Flat rate per student for combined/group sessions';
