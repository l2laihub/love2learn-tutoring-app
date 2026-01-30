-- Migration: Add message_threads table to realtime publication
-- This enables real-time updates when threads are deleted or archived

-- Add message_threads table to realtime publication for DELETE and UPDATE events
ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
