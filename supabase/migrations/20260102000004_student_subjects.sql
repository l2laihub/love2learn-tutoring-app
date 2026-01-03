-- Migration: Add subjects column to students
-- Version: 20260102000004
-- Description: Adds a subjects array column to track which subjects each student is learning

-- ============================================================================
-- ADD SUBJECTS COLUMN
-- ============================================================================

-- Add subjects column as a text array
-- Valid values: 'piano', 'math'
-- Default to both subjects
ALTER TABLE students
ADD COLUMN IF NOT EXISTS subjects TEXT[] DEFAULT ARRAY['piano', 'math']::TEXT[];

-- Add a check constraint to ensure only valid subjects
ALTER TABLE students
ADD CONSTRAINT valid_subjects CHECK (
    subjects <@ ARRAY['piano', 'math']::TEXT[]
);

-- Create an index for querying by subject
CREATE INDEX IF NOT EXISTS idx_students_subjects ON students USING GIN (subjects);

-- ============================================================================
-- UPDATE EXISTING STUDENTS
-- ============================================================================

-- Set default subjects for any existing students that might have NULL
UPDATE students
SET subjects = ARRAY['piano', 'math']::TEXT[]
WHERE subjects IS NULL;
