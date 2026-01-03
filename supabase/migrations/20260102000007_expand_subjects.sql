-- Migration: Expand subjects to support more types
-- Version: 20260102000007
-- Description: Changes subjects column from enum array to text array to support
--              piano, math, reading, speech, english, and other subjects

-- ============================================================================
-- CHANGE SUBJECTS COLUMN TYPE
-- ============================================================================

-- Drop any constraints on the subjects column if they exist
-- and change to text[] to support any subject string

ALTER TABLE students
ALTER COLUMN subjects TYPE text[]
USING subjects::text[];

-- Drop the old valid_subjects constraint that only allowed piano and math
ALTER TABLE students DROP CONSTRAINT IF EXISTS valid_subjects;

-- Add new valid_subjects constraint with all supported subjects
ALTER TABLE students ADD CONSTRAINT valid_subjects
CHECK (subjects <@ ARRAY['piano', 'math', 'reading', 'speech', 'english']::text[]);

-- Add a comment explaining the subjects field
COMMENT ON COLUMN students.subjects IS 'Array of subject names the student is enrolled in (e.g., piano, math, reading, speech, english)';
