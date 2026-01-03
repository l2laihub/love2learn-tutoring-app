-- Migration: Make parent user_id nullable for imports
-- Version: 20260102000006
-- Description: Allows parents to be created without a user_id (for import feature)
--              The user_id will be set when the parent registers/logs in

-- ============================================================================
-- MAKE user_id NULLABLE
-- ============================================================================

-- The user_id column needs to be nullable so tutors can import parents
-- who haven't registered yet. When a parent registers, we'll update their
-- user_id to link their auth account to their parent record.

ALTER TABLE parents
ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment explaining the nullable user_id
COMMENT ON COLUMN parents.user_id IS 'Links to auth.users. NULL for imported parents who have not yet registered.';
