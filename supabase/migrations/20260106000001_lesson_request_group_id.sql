-- Migration: Add request_group_id to lesson_requests
-- Version: 20260105000003
-- Description: Adds request_group_id to link multiple reschedule requests for combined sessions

-- ============================================================================
-- ADD REQUEST_GROUP_ID COLUMN
-- ============================================================================

ALTER TABLE lesson_requests
ADD COLUMN IF NOT EXISTS request_group_id UUID;

-- ============================================================================
-- ADD INDEX FOR GROUP LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_requests_group_id
ON lesson_requests(request_group_id)
WHERE request_group_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN lesson_requests.request_group_id IS 'Groups multiple requests for combined session reschedules - all requests with the same group_id are for the same combined session';
