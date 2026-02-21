-- Migration: Fix orphaned payments with NULL tutor_id
-- Version: 20260220000001
-- Description: Fixes payments that have NULL tutor_id, which makes them invisible
-- due to RLS policies and blocks new payment creation via unique constraint.
--
-- Root cause: When generateQuickInvoice creates a payment, the trigger
-- set_payment_tutor_id should set tutor_id from the parent's tutor_id.
-- However, if the parent's tutor_id is also NULL (e.g., the parent IS the tutor),
-- the fallback get_current_tutor_id() may not work in all contexts.

-- Fix payments with NULL tutor_id by deriving from the parent's tutor_id or
-- from the tutor who owns the parent
DO $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- First: set tutor_id from the parent's tutor_id (for parent-role parents)
  UPDATE payments p
  SET tutor_id = par.tutor_id
  FROM parents par
  WHERE p.parent_id = par.id
    AND p.tutor_id IS NULL
    AND par.tutor_id IS NOT NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % payments using parent.tutor_id', v_rows_updated;
  END IF;

  -- Second: for payments where the parent IS a tutor, set tutor_id to the parent's own id
  UPDATE payments p
  SET tutor_id = par.id
  FROM parents par
  WHERE p.parent_id = par.id
    AND p.tutor_id IS NULL
    AND par.role = 'tutor';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % payments where parent is a tutor', v_rows_updated;
  END IF;

  -- Third: for any remaining NULL tutor_id, try to derive from the student's tutor_id
  -- via payment_lessons -> scheduled_lessons -> students
  UPDATE payments p
  SET tutor_id = sl.tutor_id
  FROM payment_lessons pl
  JOIN scheduled_lessons sl ON sl.id = pl.lesson_id
  WHERE pl.payment_id = p.id
    AND p.tutor_id IS NULL
    AND sl.tutor_id IS NOT NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated > 0 THEN
    RAISE NOTICE 'Fixed % payments using lesson tutor_id', v_rows_updated;
  END IF;
END $$;

-- Also fix the set_payment_tutor_id trigger to be more robust
-- If the parent IS a tutor (role='tutor'), use their own id as tutor_id
CREATE OR REPLACE FUNCTION set_payment_tutor_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
BEGIN
  -- If tutor_id is not set, determine it from the parent
  IF NEW.tutor_id IS NULL THEN
    SELECT id, role, tutor_id INTO v_parent
    FROM parents
    WHERE id = NEW.parent_id;

    IF v_parent IS NOT NULL THEN
      IF v_parent.role = 'tutor' THEN
        -- Parent IS the tutor - use their own id
        NEW.tutor_id := v_parent.id;
      ELSIF v_parent.tutor_id IS NOT NULL THEN
        -- Parent has a tutor_id - use it
        NEW.tutor_id := v_parent.tutor_id;
      ELSE
        -- Fallback to current tutor
        NEW.tutor_id := get_current_tutor_id();
      END IF;
    ELSE
      -- Fallback to current tutor
      NEW.tutor_id := get_current_tutor_id();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
