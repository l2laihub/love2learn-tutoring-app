-- Migration: Link Invitations to Tutors for Multi-tenant Support
-- Version: 20260201000006
-- Description: Updates the invitation system to properly link parents to their tutors
--
-- This migration:
-- - Updates validate_invitation_token to return tutor information
-- - Updates handle_new_user to set tutor_id when parent registers via invitation
-- - Adds subscription validation for invitation acceptance
-- - Creates helper function to check tutor subscription status

-- ============================================================================
-- UPDATE VALIDATE_INVITATION_TOKEN TO RETURN TUTOR INFO
-- ============================================================================

-- Drop and recreate to update the return type
DROP FUNCTION IF EXISTS validate_invitation_token(UUID);

CREATE OR REPLACE FUNCTION validate_invitation_token(token UUID)
RETURNS TABLE(
    parent_id UUID,
    email TEXT,
    name TEXT,
    tutor_id UUID,
    tutor_business_name TEXT,
    tutor_name TEXT,
    tutor_subscription_active BOOLEAN,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_parent RECORD;
    v_tutor RECORD;
    v_subscription_active BOOLEAN;
BEGIN
    -- Find the parent record with the invitation token
    SELECT p.id, p.email, p.name, p.tutor_id, p.user_id, p.invitation_expires_at
    INTO v_parent
    FROM parents p
    WHERE p.invitation_token = token;

    -- If no parent found with this token
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            FALSE,
            FALSE,
            'Invalid invitation token'::TEXT;
        RETURN;
    END IF;

    -- If parent already has an account
    IF v_parent.user_id IS NOT NULL THEN
        RETURN QUERY SELECT
            v_parent.id,
            v_parent.email,
            v_parent.name,
            v_parent.tutor_id,
            NULL::TEXT,
            NULL::TEXT,
            FALSE,
            FALSE,
            'Account already activated'::TEXT;
        RETURN;
    END IF;

    -- If invitation expired
    IF v_parent.invitation_expires_at < NOW() THEN
        RETURN QUERY SELECT
            v_parent.id,
            v_parent.email,
            v_parent.name,
            v_parent.tutor_id,
            NULL::TEXT,
            NULL::TEXT,
            FALSE,
            FALSE,
            'Invitation has expired'::TEXT;
        RETURN;
    END IF;

    -- Get tutor information if tutor_id exists
    IF v_parent.tutor_id IS NOT NULL THEN
        SELECT t.id, t.business_name, t.name, t.subscription_status, t.trial_ends_at, t.subscription_ends_at
        INTO v_tutor
        FROM parents t
        WHERE t.id = v_parent.tutor_id AND t.role = 'tutor';

        IF FOUND THEN
            -- Check subscription status
            v_subscription_active := is_subscription_active(v_parent.tutor_id);

            -- If tutor subscription is not active
            IF NOT v_subscription_active THEN
                RETURN QUERY SELECT
                    v_parent.id,
                    v_parent.email,
                    v_parent.name,
                    v_parent.tutor_id,
                    v_tutor.business_name,
                    v_tutor.name,
                    FALSE,
                    FALSE,
                    'This invitation is no longer valid - please contact your tutor'::TEXT;
                RETURN;
            END IF;

            -- Valid invitation with tutor info
            RETURN QUERY SELECT
                v_parent.id,
                v_parent.email,
                v_parent.name,
                v_parent.tutor_id,
                v_tutor.business_name,
                v_tutor.name,
                TRUE,
                TRUE,
                NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Valid invitation but no tutor linked (legacy case)
    -- Still allow registration but without tutor info
    RETURN QUERY SELECT
        v_parent.id,
        v_parent.email,
        v_parent.name,
        NULL::UUID,
        NULL::TEXT,
        NULL::TEXT,
        TRUE,
        TRUE,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION validate_invitation_token(UUID) IS 'Validates an invitation token and returns parent and tutor info. Checks tutor subscription status.';

-- Grant execute to anon (for registration page) and authenticated
GRANT EXECUTE ON FUNCTION validate_invitation_token(UUID) TO anon, authenticated;

-- ============================================================================
-- UPDATE HANDLE_NEW_USER TRIGGER TO ENSURE TUTOR_ID IS SET
-- ============================================================================

-- Update handle_new_user to preserve tutor_id from the parent record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_parent_id UUID;
    invitation_token_value UUID;
    existing_tutor_id UUID;
BEGIN
    -- Check if there's an invitation token in the user metadata
    invitation_token_value := (NEW.raw_user_meta_data->>'invitation_token')::UUID;

    -- First, try to find by invitation token if provided
    IF invitation_token_value IS NOT NULL THEN
        SELECT id, tutor_id INTO existing_parent_id, existing_tutor_id
        FROM public.parents
        WHERE invitation_token = invitation_token_value
          AND user_id IS NULL
          AND invitation_expires_at > NOW();

        IF existing_parent_id IS NOT NULL THEN
            -- Link the existing parent record to this auth user via invitation
            -- tutor_id is already set on the parent record from when they were created
            UPDATE public.parents
            SET
                user_id = NEW.id,
                invitation_accepted_at = NOW(),
                updated_at = NOW()
            WHERE id = existing_parent_id;

            RETURN NEW;
        END IF;
    END IF;

    -- Fallback: Check if there's an existing parent record with this email and no user_id
    SELECT id, tutor_id INTO existing_parent_id, existing_tutor_id
    FROM public.parents
    WHERE email = NEW.email AND user_id IS NULL;

    IF existing_parent_id IS NOT NULL THEN
        -- Link the existing parent record to this auth user
        -- tutor_id is already set on the parent record from when they were created
        UPDATE public.parents
        SET
            user_id = NEW.id,
            invitation_accepted_at = CASE
                WHEN invitation_sent_at IS NOT NULL THEN NOW()
                ELSE invitation_accepted_at
            END,
            updated_at = NOW()
        WHERE id = existing_parent_id;
    ELSE
        -- No existing parent found, create a new parent record
        -- This handles the case of a completely new user signing up (likely a tutor)
        -- New tutors signing up directly won't have a tutor_id (they ARE the tutor)
        INSERT INTO public.parents (
            id,
            user_id,
            email,
            name,
            role,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'role', 'parent'),
            NOW(),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION TO GET TUTOR INFO BY PARENT ID
-- ============================================================================

-- Helper function to get tutor info for a parent (useful for onboarding screens)
CREATE OR REPLACE FUNCTION get_parent_tutor_info(p_parent_id UUID)
RETURNS TABLE(
    tutor_id UUID,
    tutor_name TEXT,
    business_name TEXT,
    subscription_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent RECORD;
    v_tutor RECORD;
BEGIN
    -- Get the parent's tutor_id
    SELECT p.tutor_id INTO v_parent
    FROM parents p
    WHERE p.id = p_parent_id;

    IF NOT FOUND OR v_parent.tutor_id IS NULL THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            FALSE;
        RETURN;
    END IF;

    -- Get tutor info
    SELECT t.id, t.name, t.business_name
    INTO v_tutor
    FROM parents t
    WHERE t.id = v_parent.tutor_id AND t.role = 'tutor';

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            FALSE;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        v_tutor.id,
        v_tutor.name,
        v_tutor.business_name,
        is_subscription_active(v_tutor.id);
END;
$$;

COMMENT ON FUNCTION get_parent_tutor_info(UUID) IS 'Returns tutor information for a parent, including business name and subscription status';

GRANT EXECUTE ON FUNCTION get_parent_tutor_info(UUID) TO authenticated;

-- ============================================================================
-- FUNCTION FOR CURRENT USER TO GET THEIR TUTOR INFO
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_tutor_info()
RETURNS TABLE(
    tutor_id UUID,
    tutor_name TEXT,
    business_name TEXT,
    subscription_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent_id UUID;
BEGIN
    -- Get current user's parent id
    SELECT id INTO v_parent_id
    FROM parents
    WHERE user_id = auth.uid() AND role = 'parent';

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            FALSE;
        RETURN;
    END IF;

    -- Use the existing function
    RETURN QUERY SELECT * FROM get_parent_tutor_info(v_parent_id);
END;
$$;

COMMENT ON FUNCTION get_my_tutor_info() IS 'Returns tutor information for the current authenticated parent user';

GRANT EXECUTE ON FUNCTION get_my_tutor_info() TO authenticated;
