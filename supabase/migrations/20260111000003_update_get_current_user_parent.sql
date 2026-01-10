-- Migration: Update get_current_user_parent to include avatar_url
-- Version: 20260111000003
-- Description: Updates the RPC function to include the avatar_url field
--              that was added in migration 20260111000001

-- Drop existing function and recreate with avatar_url
DROP FUNCTION IF EXISTS public.get_current_user_parent();

CREATE FUNCTION public.get_current_user_parent()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT,
    avatar_url TEXT,  -- Added: parent profile photo URL
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
        p.avatar_url,  -- Added: include avatar_url in result
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

-- Comment
COMMENT ON FUNCTION public.get_current_user_parent() IS
'Returns the parent record for the currently authenticated user, bypassing RLS.
This solves the recursion issue where RLS policy calls is_tutor() which queries
parents table again. Safe because it only returns the current user''s own record.
Updated in 20260111000003 to include avatar_url field.';
