-- Migration: Parent Worksheet Permissions
-- Version: 20260103000006
-- Description: Allows parents to mark worksheets as completed

-- ============================================================================
-- UPDATE RLS POLICIES FOR ASSIGNMENTS
-- ============================================================================

-- Drop existing parent-related policies if they exist
DROP POLICY IF EXISTS "Parents can update assignment status" ON assignments;

-- Parents can update the status of their children's assignments (to mark as completed)
CREATE POLICY "Parents can update assignment status"
    ON assignments
    FOR UPDATE
    USING (
        student_id IN (
            SELECT s.id FROM students s
            JOIN parents p ON s.parent_id = p.id
            WHERE p.user_id = auth.uid()
        )
    )
    WITH CHECK (
        student_id IN (
            SELECT s.id FROM students s
            JOIN parents p ON s.parent_id = p.id
            WHERE p.user_id = auth.uid()
        )
    );

-- ============================================================================
-- ADD COMPLETED_BY COLUMN TO TRACK WHO MARKED IT COMPLETE
-- ============================================================================

ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES parents(id);

COMMENT ON COLUMN assignments.completed_by IS 'Parent or tutor who marked the assignment as completed';
