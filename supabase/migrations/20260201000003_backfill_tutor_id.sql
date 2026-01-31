-- Migration: Backfill tutor_id for existing data
-- Version: 20260201000003
-- Description: Populates tutor_id columns with existing tutor's ID for all related tables
--
-- This migration is idempotent (safe to run multiple times):
-- - Only updates rows where tutor_id IS NULL
-- - Uses a single transaction to ensure consistency
-- - Falls back gracefully if no tutor exists

-- ============================================================================
-- BACKFILL TUTOR_ID FOR ALL EXISTING DATA
-- ============================================================================

DO $$
DECLARE
  v_tutor_id UUID;
  v_rows_updated INTEGER;
BEGIN
  -- Find the existing tutor
  -- In a single-tutor setup, there should be exactly one tutor
  SELECT id INTO v_tutor_id
  FROM parents
  WHERE role = 'tutor'
  ORDER BY created_at ASC  -- Get the oldest tutor if multiple exist
  LIMIT 1;

  -- If no tutor exists, log and exit gracefully
  IF v_tutor_id IS NULL THEN
    RAISE NOTICE 'No tutor found in parents table. Skipping backfill.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found tutor with ID: %. Starting backfill...', v_tutor_id;

  -- ========================================================================
  -- BACKFILL STUDENTS TABLE
  -- ========================================================================
  UPDATE students
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % student(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL PARENTS TABLE (non-tutor parents)
  -- ========================================================================
  UPDATE parents
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL
    AND role = 'parent';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % parent(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL MESSAGE_THREADS TABLE
  -- ========================================================================
  UPDATE message_threads
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % message_thread(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL NOTIFICATIONS TABLE
  -- ========================================================================
  UPDATE notifications
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % notification(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL PARENT_GROUPS TABLE
  -- ========================================================================
  UPDATE parent_groups
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % parent_group(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL PAYMENTS TABLE
  -- ========================================================================
  UPDATE payments
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % payment(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL SCHEDULED_LESSONS TABLE
  -- ========================================================================
  UPDATE scheduled_lessons
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % scheduled_lesson(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- BACKFILL ASSIGNMENTS TABLE
  -- ========================================================================
  UPDATE assignments
  SET tutor_id = v_tutor_id
  WHERE tutor_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % assignment(s) with tutor_id', v_rows_updated;
  END IF;

  -- ========================================================================
  -- NOTE: SHARED_RESOURCES ALREADY HAS TUTOR_ID
  -- ========================================================================
  -- The shared_resources table was created with a NOT NULL tutor_id column,
  -- so all existing rows should already have a tutor_id set. We don't need
  -- to backfill this table, but let's verify and warn if any are NULL.

  SELECT COUNT(*) INTO v_rows_updated
  FROM shared_resources
  WHERE tutor_id IS NULL;

  IF v_rows_updated > 0 THEN
    RAISE WARNING 'Found % shared_resource(s) with NULL tutor_id. These need manual review.', v_rows_updated;
  END IF;

  RAISE NOTICE 'Backfill complete for tutor ID: %', v_tutor_id;

END $$;

-- ============================================================================
-- VERIFICATION QUERY (for manual verification after migration)
-- ============================================================================
-- Run this query after migration to verify backfill:
--
-- SELECT
--   'students' as table_name, COUNT(*) FILTER (WHERE tutor_id IS NULL) as null_count, COUNT(*) as total FROM students
-- UNION ALL SELECT 'parents (non-tutor)', COUNT(*) FILTER (WHERE tutor_id IS NULL AND role = 'parent'), COUNT(*) FILTER (WHERE role = 'parent') FROM parents
-- UNION ALL SELECT 'message_threads', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM message_threads
-- UNION ALL SELECT 'notifications', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM notifications
-- UNION ALL SELECT 'parent_groups', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM parent_groups
-- UNION ALL SELECT 'payments', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM payments
-- UNION ALL SELECT 'scheduled_lessons', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM scheduled_lessons
-- UNION ALL SELECT 'assignments', COUNT(*) FILTER (WHERE tutor_id IS NULL), COUNT(*) FROM assignments;
