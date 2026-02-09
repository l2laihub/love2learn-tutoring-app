-- Migration: Fix parent_agreements RLS policy to filter by tutor_id
-- Version: 20260202000006
-- Description: The "Tutors can view all agreements" policy allows any tutor to see all agreements.
--              This fix ensures each tutor only sees agreements from their own parents.

-- Drop existing policy
DROP POLICY IF EXISTS "Tutors can view all agreements" ON parent_agreements;
DROP POLICY IF EXISTS "Tutors can create agreements" ON parent_agreements;

-- Recreate with proper tutor_id filtering
-- Tutors can only view agreements for parents linked to them
CREATE POLICY "Tutors can view all agreements"
ON parent_agreements
FOR SELECT
TO authenticated
USING (
    is_tutor() AND
    parent_id IN (
        SELECT id FROM parents
        WHERE tutor_id = get_current_tutor_id()
    )
);

-- Tutors can create agreements for their own parents
CREATE POLICY "Tutors can create agreements"
ON parent_agreements
FOR INSERT
TO authenticated
WITH CHECK (
    is_tutor() AND
    parent_id IN (
        SELECT id FROM parents
        WHERE tutor_id = get_current_tutor_id()
    )
);

-- Add comment
COMMENT ON POLICY "Tutors can view all agreements" ON parent_agreements IS 'Tutors can only view agreements from parents linked to them';
