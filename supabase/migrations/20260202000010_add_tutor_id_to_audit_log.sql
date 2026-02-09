-- Migration: Add tutor_id to admin_audit_log for multi-tutor isolation
-- Version: 20260202000010
-- Description: Each tutor should only see their own audit log entries.

-- ============================================================================
-- ADD TUTOR_ID COLUMN
-- ============================================================================

ALTER TABLE admin_audit_log
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_tutor_id
ON admin_audit_log(tutor_id);

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Set tutor_id based on admin_user_id (the user who performed the action)
UPDATE admin_audit_log aal
SET tutor_id = p.id
FROM parents p
WHERE p.user_id = aal.admin_user_id
  AND p.role = 'tutor'
  AND aal.tutor_id IS NULL;

-- For any remaining entries without tutor_id, assign to original tutor
DO $$
DECLARE
    v_original_tutor_id UUID;
BEGIN
    SELECT p.id INTO v_original_tutor_id
    FROM parents p
    WHERE p.role = 'tutor'
    AND EXISTS (SELECT 1 FROM students s WHERE s.tutor_id = p.id)
    ORDER BY (SELECT COUNT(*) FROM students WHERE tutor_id = p.id) DESC
    LIMIT 1;

    IF v_original_tutor_id IS NOT NULL THEN
        UPDATE admin_audit_log
        SET tutor_id = v_original_tutor_id
        WHERE tutor_id IS NULL;
    END IF;
END $$;

-- ============================================================================
-- UPDATE RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Tutors can view audit log" ON admin_audit_log;

CREATE POLICY "Tutors can view audit log"
ON admin_audit_log
FOR SELECT
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- Update insert policy to set tutor_id
DROP POLICY IF EXISTS "System can insert audit log" ON admin_audit_log;

CREATE POLICY "System can insert audit log"
ON admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
    tutor_id IS NULL OR tutor_id = get_current_tutor_id()
);

-- ============================================================================
-- ADD TRIGGER FOR AUTO-SETTING TUTOR_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION set_audit_log_tutor_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tutor_id IS NULL THEN
        -- Try to get tutor_id from admin_user_id first
        SELECT p.id INTO NEW.tutor_id
        FROM parents p
        WHERE p.user_id = NEW.admin_user_id AND p.role = 'tutor';

        -- If not found, use current tutor
        IF NEW.tutor_id IS NULL THEN
            NEW.tutor_id := get_current_tutor_id();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_audit_log_tutor_id ON admin_audit_log;
CREATE TRIGGER trigger_set_audit_log_tutor_id
    BEFORE INSERT ON admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_log_tutor_id();

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON COLUMN admin_audit_log.tutor_id IS 'The tutor context for this audit entry';
