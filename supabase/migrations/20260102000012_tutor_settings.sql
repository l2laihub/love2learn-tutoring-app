-- Migration: Create tutor_settings table for rate configuration
-- This stores the tutor's hourly rates per subject and combined session flat rate

-- Create tutor_settings table
CREATE TABLE IF NOT EXISTS tutor_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    default_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    subject_rates JSONB NOT NULL DEFAULT '{}',
    combined_session_rate DECIMAL(10,2) NOT NULL DEFAULT 40.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Each tutor can only have one settings record
    CONSTRAINT tutor_settings_unique UNIQUE (tutor_id)
);

-- Add comment explaining the table
COMMENT ON TABLE tutor_settings IS 'Stores tutor rate configuration for billing';
COMMENT ON COLUMN tutor_settings.default_hourly_rate IS 'Default hourly rate when no subject-specific rate is set';
COMMENT ON COLUMN tutor_settings.subject_rates IS 'JSON object with per-subject rates, e.g., {"piano": 60, "math": 45}';
COMMENT ON COLUMN tutor_settings.combined_session_rate IS 'Flat rate per student for combined/group sessions';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tutor_settings_tutor_id ON tutor_settings(tutor_id);

-- Enable RLS
ALTER TABLE tutor_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Tutors can read and update their own settings
CREATE POLICY "Tutors can manage their own settings"
    ON tutor_settings
    FOR ALL
    USING (tutor_id = auth.uid())
    WITH CHECK (tutor_id = auth.uid());

-- Policy: Allow authenticated users to read tutor settings (for invoice calculation)
CREATE POLICY "Authenticated users can read tutor settings"
    ON tutor_settings
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tutor_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tutor_settings_updated_at
    BEFORE UPDATE ON tutor_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_tutor_settings_updated_at();
