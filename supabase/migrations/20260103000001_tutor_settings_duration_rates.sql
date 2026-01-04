-- Migration: Update tutor_settings to support duration-based rates
-- Changes from hourly rate to rate per base duration (e.g., $35 for 30 min, $45 for 60 min)

-- Rename default_hourly_rate to default_rate (only if old column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'tutor_settings'
        AND column_name = 'default_hourly_rate'
    ) THEN
        ALTER TABLE tutor_settings RENAME COLUMN default_hourly_rate TO default_rate;
    END IF;
END $$;

-- Add default_base_duration column (in minutes) if it doesn't exist
ALTER TABLE tutor_settings
ADD COLUMN IF NOT EXISTS default_base_duration INTEGER NOT NULL DEFAULT 60;

-- Ensure default_rate column exists (in case table was created without it)
ALTER TABLE tutor_settings
ADD COLUMN IF NOT EXISTS default_rate DECIMAL(10,2) NOT NULL DEFAULT 50.00;

-- Update comment for clarity
COMMENT ON COLUMN tutor_settings.default_rate IS 'Default rate amount in dollars';
COMMENT ON COLUMN tutor_settings.default_base_duration IS 'Base duration in minutes for the default rate (e.g., 60 means rate is per hour)';
COMMENT ON COLUMN tutor_settings.subject_rates IS 'JSON object with per-subject rate config: { subject: { rate: number, base_duration: number } }';
COMMENT ON COLUMN tutor_settings.combined_session_rate IS 'Flat rate per student for combined/group sessions';
