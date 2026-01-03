-- Migration: Add hourly rates to students table
-- Version: 20260102000010
-- Description: Adds hourly_rate column to students for invoice calculation

-- ============================================================================
-- ADD HOURLY RATE COLUMN
-- ============================================================================

-- Add hourly rate per student (default $50/hour)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 50.00;

-- Add per-subject rate overrides (optional, stored as JSON)
-- Format: { "piano": 60.00, "math": 50.00 }
ALTER TABLE students
ADD COLUMN IF NOT EXISTS subject_rates JSONB DEFAULT '{}';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN students.hourly_rate IS 'Default hourly rate for this student in dollars';
COMMENT ON COLUMN students.subject_rates IS 'Optional per-subject rate overrides as JSON, e.g. {"piano": 60.00, "math": 50.00}';
