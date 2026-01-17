-- Migration: Add original_lesson_id to lesson_requests
-- Description: Tracks the original lesson being rescheduled so it can be cancelled when approved

-- Add original_lesson_id column to track which lesson is being rescheduled
ALTER TABLE lesson_requests
ADD COLUMN IF NOT EXISTS original_lesson_id UUID REFERENCES scheduled_lessons(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lesson_requests_original_lesson_id
ON lesson_requests(original_lesson_id);

-- Add comment
COMMENT ON COLUMN lesson_requests.original_lesson_id IS 'References the original lesson being rescheduled. Used to cancel the original when reschedule is approved.';
