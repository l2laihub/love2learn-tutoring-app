-- Migration: Fix Parent RLS Recursion Issue
-- Version: 20260104000004
-- Description: Creates a SECURITY DEFINER function to get current user's parent record
--              without triggering RLS recursion. The current RLS policy on parents table
--              calls is_tutor() which queries parents table again, causing infinite recursion
--              or severe performance issues.

-- ============================================================================
-- CREATE FUNCTION: Get current user's parent record (bypasses RLS)
-- ============================================================================

-- This function is SECURITY DEFINER, meaning it runs with the privileges of the
-- function owner (postgres), bypassing RLS entirely. This is safe because:
-- 1. It only returns the parent record for the authenticated user (auth.uid())
-- 2. Users cannot access other users' parent records through this function

-- Drop existing function if it exists (to handle type changes)
DROP FUNCTION IF EXISTS public.get_current_user_parent();

CREATE FUNCTION public.get_current_user_parent()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT,
    onboarding_completed_at TIMESTAMPTZ,
    preferences JSONB,
    invitation_token UUID,
    invitation_sent_at TIMESTAMPTZ,
    invitation_expires_at TIMESTAMPTZ,
    invitation_accepted_at TIMESTAMPTZ,
    requires_agreement BOOLEAN,
    agreement_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.user_id,
        p.name,
        p.email,
        p.phone,
        p.role,
        p.onboarding_completed_at,
        p.preferences,
        p.invitation_token,
        p.invitation_sent_at,
        p.invitation_expires_at,
        p.invitation_accepted_at,
        p.requires_agreement,
        p.agreement_signed_at,
        p.created_at,
        p.updated_at
    FROM parents p
    WHERE p.user_id = auth.uid()
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_parent() TO authenticated;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION public.get_current_user_parent() IS
'Returns the parent record for the currently authenticated user, bypassing RLS.
This solves the recursion issue where RLS policy calls is_tutor() which queries
parents table again. Safe because it only returns the current user''s own record.';
