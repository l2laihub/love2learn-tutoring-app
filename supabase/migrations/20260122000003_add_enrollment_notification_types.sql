-- Migration: Add enrollment notification types
-- Version: 20260122000003
-- Description: Adds enrollment_request and enrollment_response to notification_type enum

-- Add new values to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'enrollment_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'enrollment_response';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dropin_request';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'dropin_response';

-- Note: For tutors to see enrollment requests, the notification should have:
-- recipient_id = NULL (broadcast, but tutors see all via RLS)
-- sender_id = parent who made the request
