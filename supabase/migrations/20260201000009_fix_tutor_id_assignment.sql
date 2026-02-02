-- Migration: Fix tutor_id assignment for existing data
-- Version: 20260201000009
-- Description: Reassigns data to the correct tutor when backfill used wrong ID
--
-- Problem: The original backfill (20260201000003) assigned all data to the
-- "oldest" tutor by created_at. With multiple tutors, this may have assigned
-- data to the wrong tutor, making it invisible to the actual data owner.
--
-- Solution: Find the tutor that actually has parent relationships (via students)
-- and reassign all data to them.

DO $$
DECLARE
  v_correct_tutor_id UUID;
  v_rows_updated INTEGER;
  v_tutor_count INTEGER;
BEGIN
  -- Count tutors
  SELECT COUNT(*) INTO v_tutor_count FROM parents WHERE role = 'tutor';
  RAISE NOTICE 'Found % tutor(s) in the system', v_tutor_count;

  IF v_tutor_count = 0 THEN
    RAISE NOTICE 'No tutors found. Skipping fix.';
    RETURN;
  END IF;

  -- Strategy: Find the tutor that has actual student data
  -- (students linked to parents who are not tutors)
  SELECT DISTINCT p.id INTO v_correct_tutor_id
  FROM parents p
  WHERE p.role = 'tutor'
  AND EXISTS (
    SELECT 1 FROM students s
    JOIN parents parent ON s.parent_id = parent.id
    WHERE parent.role = 'parent'
  )
  LIMIT 1;

  -- Fallback: If no tutor found with data relationships,
  -- find the tutor who has students directly assigned
  IF v_correct_tutor_id IS NULL THEN
    SELECT p.id INTO v_correct_tutor_id
    FROM parents p
    WHERE p.role = 'tutor'
    AND EXISTS (SELECT 1 FROM students s WHERE s.tutor_id = p.id)
    LIMIT 1;
  END IF;

  -- Final fallback: Use the most recently created tutor
  -- (likely the active one, not a test account)
  IF v_correct_tutor_id IS NULL THEN
    SELECT p.id INTO v_correct_tutor_id
    FROM parents p
    WHERE p.role = 'tutor'
    ORDER BY p.created_at DESC
    LIMIT 1;
    RAISE NOTICE 'Using most recently created tutor as fallback';
  END IF;

  IF v_correct_tutor_id IS NULL THEN
    RAISE NOTICE 'No suitable tutor found. Skipping fix.';
    RETURN;
  END IF;

  RAISE NOTICE 'Reassigning all data to tutor ID: %', v_correct_tutor_id;

  -- ========================================================================
  -- UPDATE ALL TABLES TO USE THE CORRECT TUTOR_ID
  -- ========================================================================
  -- Using IS DISTINCT FROM to handle NULL values correctly
  -- This updates both NULL values AND incorrectly assigned values

  -- Students
  UPDATE students
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % student(s)', v_rows_updated;
  END IF;

  -- Parents (non-tutor only)
  UPDATE parents
  SET tutor_id = v_correct_tutor_id
  WHERE role = 'parent'
    AND tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % parent(s)', v_rows_updated;
  END IF;

  -- Scheduled Lessons
  UPDATE scheduled_lessons
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % scheduled_lesson(s)', v_rows_updated;
  END IF;

  -- Payments
  UPDATE payments
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % payment(s)', v_rows_updated;
  END IF;

  -- Message Threads
  UPDATE message_threads
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % message_thread(s)', v_rows_updated;
  END IF;

  -- Notifications
  UPDATE notifications
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % notification(s)', v_rows_updated;
  END IF;

  -- Parent Groups
  UPDATE parent_groups
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % parent_group(s)', v_rows_updated;
  END IF;

  -- Assignments
  UPDATE assignments
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % assignment(s)', v_rows_updated;
  END IF;

  -- Shared Resources
  UPDATE shared_resources
  SET tutor_id = v_correct_tutor_id
  WHERE tutor_id IS DISTINCT FROM v_correct_tutor_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Updated % shared_resource(s)', v_rows_updated;
  END IF;

  RAISE NOTICE 'Fix complete. All data now belongs to tutor: %', v_correct_tutor_id;
END $$;

-- ============================================================================
-- VERIFICATION QUERY (run after migration to confirm)
-- ============================================================================
-- SELECT
--   'students' as table_name,
--   tutor_id,
--   COUNT(*) as count
-- FROM students
-- GROUP BY tutor_id
-- UNION ALL
-- SELECT 'scheduled_lessons', tutor_id, COUNT(*) FROM scheduled_lessons GROUP BY tutor_id
-- UNION ALL
-- SELECT 'payments', tutor_id, COUNT(*) FROM payments GROUP BY tutor_id;
