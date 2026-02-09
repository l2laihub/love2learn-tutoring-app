-- Migration: Fix admin dashboard stats to filter by tutor_id
-- Version: 20260202000005
-- Description: The get_admin_dashboard_stats function was returning stats for ALL tutors.
--              This fix ensures each tutor only sees their own dashboard stats.

-- Drop existing function first
DROP FUNCTION IF EXISTS get_admin_dashboard_stats();

-- Recreate the function with tutor_id filtering
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(
    total_parents BIGINT,
    active_parents BIGINT,
    pending_agreements BIGINT,
    signed_agreements BIGINT,
    total_students BIGINT,
    pending_invitations BIGINT
) AS $$
DECLARE
    current_tutor UUID;
BEGIN
    -- Get the current tutor's ID
    current_tutor := get_current_tutor_id();

    -- If no tutor context, return zeros
    IF current_tutor IS NULL THEN
        RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        -- Total parents linked to this tutor
        (SELECT COUNT(*) FROM parents WHERE role = 'parent' AND tutor_id = current_tutor)::BIGINT as total_parents,

        -- Active parents (have a user account) linked to this tutor
        (SELECT COUNT(*) FROM parents WHERE role = 'parent' AND tutor_id = current_tutor AND user_id IS NOT NULL)::BIGINT as active_parents,

        -- Pending agreements for parents linked to this tutor
        (SELECT COUNT(*) FROM parent_agreements pa
         JOIN parents p ON pa.parent_id = p.id
         WHERE pa.status = 'pending' AND p.tutor_id = current_tutor)::BIGINT as pending_agreements,

        -- Signed agreements for parents linked to this tutor
        (SELECT COUNT(*) FROM parent_agreements pa
         JOIN parents p ON pa.parent_id = p.id
         WHERE pa.status = 'signed' AND p.tutor_id = current_tutor)::BIGINT as signed_agreements,

        -- Total students belonging to this tutor
        (SELECT COUNT(*) FROM students WHERE tutor_id = current_tutor)::BIGINT as total_students,

        -- Pending invitations for parents linked to this tutor
        (SELECT COUNT(*) FROM parents
         WHERE role = 'parent'
           AND tutor_id = current_tutor
           AND user_id IS NULL
           AND invitation_sent_at IS NOT NULL
           AND (invitation_expires_at IS NULL OR invitation_expires_at > NOW()))::BIGINT as pending_invitations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_admin_dashboard_stats() IS 'Returns dashboard statistics for the CURRENT TUTOR only. Includes parent counts, agreement status, student counts, and pending invitations.';
