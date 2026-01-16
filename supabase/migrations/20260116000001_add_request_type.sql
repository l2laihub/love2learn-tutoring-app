-- Migration: Add request_type to lesson_requests
-- Description: Adds request_type column to distinguish reschedule vs drop-in requests
-- Drop-in requests are for new additional sessions, not tied to existing lessons

-- Add request_type column with default 'reschedule' for backward compatibility
ALTER TABLE lesson_requests
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'reschedule'
CHECK (request_type IN ('reschedule', 'dropin'));

-- Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_lesson_requests_type
ON lesson_requests(request_type);

-- Add comment for documentation
COMMENT ON COLUMN lesson_requests.request_type IS 'Type of request: reschedule (changing existing lesson time) or dropin (requesting new additional session)';
