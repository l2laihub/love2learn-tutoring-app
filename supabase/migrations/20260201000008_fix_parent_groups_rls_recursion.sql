-- Migration: Fix parent_groups RLS infinite recursion
-- Version: 20260201000008
-- Description: Fixes the circular dependency between parent_groups and parent_group_members
--              RLS policies by using SECURITY DEFINER functions to bypass RLS during checks.

-- ============================================================================
-- CREATE SECURITY DEFINER FUNCTION TO CHECK GROUP MEMBERSHIP
-- ============================================================================

-- This function checks if a parent is a member of a group without triggering RLS
CREATE OR REPLACE FUNCTION is_member_of_group(p_group_id UUID, p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM parent_group_members
        WHERE group_id = p_group_id
          AND parent_id = p_parent_id
    );
END;
$$;

COMMENT ON FUNCTION is_member_of_group(UUID, UUID) IS 'Checks if a parent is a member of a group (bypasses RLS to prevent recursion)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_member_of_group(UUID, UUID) TO authenticated;

-- ============================================================================
-- CREATE SECURITY DEFINER FUNCTION TO CHECK GROUP OWNERSHIP
-- ============================================================================

-- This function checks if a group belongs to a tutor without triggering RLS
CREATE OR REPLACE FUNCTION is_group_owned_by_tutor(p_group_id UUID, p_tutor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM parent_groups
        WHERE id = p_group_id
          AND (tutor_id = p_tutor_id OR tutor_id IS NULL)
    );
END;
$$;

COMMENT ON FUNCTION is_group_owned_by_tutor(UUID, UUID) IS 'Checks if a group belongs to a tutor (bypasses RLS to prevent recursion)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_group_owned_by_tutor(UUID, UUID) TO authenticated;

-- ============================================================================
-- UPDATE PARENT_GROUPS POLICIES
-- ============================================================================

-- Drop and recreate the parents viewing policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Parents can view their groups" ON parent_groups;

CREATE POLICY "Parents can view their groups"
ON parent_groups
FOR SELECT
TO authenticated
USING (
    NOT is_tutor() AND
    is_member_of_group(id, get_parent_id())
);

-- ============================================================================
-- UPDATE PARENT_GROUP_MEMBERS POLICIES
-- ============================================================================

-- Drop and recreate the tutor management policy to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Tutors can manage group members" ON parent_group_members;

CREATE POLICY "Tutors can manage group members"
ON parent_group_members
FOR ALL
TO authenticated
USING (
    is_tutor() AND
    is_group_owned_by_tutor(group_id, get_current_tutor_id())
)
WITH CHECK (
    is_tutor() AND
    is_group_owned_by_tutor(group_id, get_current_tutor_id())
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'parent_groups and parent_group_members RLS recursion fix applied successfully';
END $$;
