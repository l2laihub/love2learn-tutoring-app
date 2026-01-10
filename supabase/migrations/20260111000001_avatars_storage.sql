-- Migration: Add avatar storage for parents and students
-- Description: Adds avatar_url to parents table and creates avatars storage bucket
--
-- NOTE: This migration has TWO parts:
-- 1. Table changes (can run via session pooler)
-- 2. Storage bucket & policies (MUST run via Supabase Dashboard SQL Editor)

-- ============================================================================
-- PART 1: TABLE CHANGES (run via session pooler or dashboard)
-- ============================================================================

ALTER TABLE parents ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN parents.avatar_url IS 'URL to the parent profile photo stored in avatars bucket';
