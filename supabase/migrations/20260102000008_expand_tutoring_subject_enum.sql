-- Migration: Expand tutoring_subject enum to include all subjects
-- Version: 20260102000008
-- Description: Adds 'reading', 'speech', and 'english' values to the tutoring_subject enum
--              used by the scheduled_lessons table for the subject column.

-- ============================================================================
-- ADD NEW ENUM VALUES
-- ============================================================================

-- Add new subject values to the tutoring_subject enum
-- Note: ALTER TYPE ... ADD VALUE cannot be run inside a transaction block
-- These statements must be run individually in Supabase SQL Editor

ALTER TYPE tutoring_subject ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE tutoring_subject ADD VALUE IF NOT EXISTS 'speech';
ALTER TYPE tutoring_subject ADD VALUE IF NOT EXISTS 'english';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After running this migration, verify the enum values with:
-- SELECT unnest(enum_range(NULL::tutoring_subject));

-- Expected output:
-- piano
-- math
-- reading
-- speech
-- english
