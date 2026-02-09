-- Migration: Fix multi-tutor data - ensure all existing data has proper tutor_id
-- Version: 20260202000001
-- Description: Fixes data leakage caused by NULL tutor_id values
--
-- Problem: Records with NULL tutor_id are visible to ALL tutors due to legacy
-- fallback clause in RLS policies: (is_tutor() AND tutor_id IS NULL)
--
-- Solution: Ensure all existing data has proper tutor_id assigned based on ownership

DO $$
DECLARE
  v_original_tutor_id UUID;
  v_new_tutor_id UUID;
  v_rows_updated INTEGER;
BEGIN
  -- ========================================================================
  -- STEP 1: Find the original tutor (lovetolearn1149) - the one with most data
  -- ========================================================================
  SELECT p.id INTO v_original_tutor_id
  FROM parents p
  WHERE p.role = 'tutor'
  AND EXISTS (SELECT 1 FROM students s WHERE s.tutor_id = p.id)
  ORDER BY (SELECT COUNT(*) FROM students WHERE tutor_id = p.id) DESC
  LIMIT 1;

  IF v_original_tutor_id IS NULL THEN
    -- Fallback: oldest tutor by created_at
    SELECT id INTO v_original_tutor_id
    FROM parents WHERE role = 'tutor'
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_original_tutor_id IS NULL THEN
    RAISE NOTICE 'No tutors found. Skipping migration.';
    RETURN;
  END IF;

  RAISE NOTICE 'Original tutor ID: %', v_original_tutor_id;

  -- ========================================================================
  -- STEP 2: Find the new tutor (huy.q.duong) if exists
  -- ========================================================================
  SELECT id INTO v_new_tutor_id
  FROM parents
  WHERE role = 'tutor' AND id != v_original_tutor_id
  LIMIT 1;

  IF v_new_tutor_id IS NOT NULL THEN
    RAISE NOTICE 'New tutor ID: %', v_new_tutor_id;
  END IF;

  -- ========================================================================
  -- STEP 3: Fix NULL tutor_id values - assign to original tutor
  -- (These are legacy records that weren't properly backfilled)
  -- ========================================================================

  -- Fix parents with NULL tutor_id (non-tutor only)
  UPDATE parents
  SET tutor_id = v_original_tutor_id
  WHERE role = 'parent' AND tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % parents with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix students with NULL tutor_id
  UPDATE students
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % students with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix scheduled_lessons with NULL tutor_id
  UPDATE scheduled_lessons
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % scheduled_lessons with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix payments with NULL tutor_id
  UPDATE payments
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % payments with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix message_threads with NULL tutor_id
  UPDATE message_threads
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % message_threads with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix notifications with NULL tutor_id
  UPDATE notifications
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % notifications with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix parent_groups with NULL tutor_id
  UPDATE parent_groups
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % parent_groups with NULL tutor_id', v_rows_updated;
  END IF;

  -- Fix assignments with NULL tutor_id
  UPDATE assignments
  SET tutor_id = v_original_tutor_id
  WHERE tutor_id IS NULL;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % assignments with NULL tutor_id', v_rows_updated;
  END IF;

  RAISE NOTICE 'Migration complete. All NULL tutor_id values have been fixed.';
END $$;

-- ============================================================================
-- VERIFICATION QUERY (uncomment to run after migration)
-- ============================================================================
-- SELECT 'students' as tbl, COUNT(*) as null_count FROM students WHERE tutor_id IS NULL
-- UNION ALL SELECT 'parents', COUNT(*) FROM parents WHERE role='parent' AND tutor_id IS NULL
-- UNION ALL SELECT 'scheduled_lessons', COUNT(*) FROM scheduled_lessons WHERE tutor_id IS NULL
-- UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE tutor_id IS NULL;
