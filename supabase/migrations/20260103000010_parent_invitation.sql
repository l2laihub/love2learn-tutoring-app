-- Migration: Parent Invitation System
-- Version: 20260103000007
-- Description: Adds invitation tracking for parent onboarding emails

-- ============================================================================
-- ADD INVITATION COLUMNS TO PARENTS TABLE
-- ============================================================================

-- Add invitation tracking columns
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS invitation_token UUID,
ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Add index for token lookups
CREATE INDEX IF NOT EXISTS idx_parents_invitation_token ON parents(invitation_token) WHERE invitation_token IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN parents.invitation_token IS 'Unique token sent in invitation email for account activation';
COMMENT ON COLUMN parents.invitation_sent_at IS 'Timestamp when the invitation email was sent';
COMMENT ON COLUMN parents.invitation_expires_at IS 'Timestamp when the invitation token expires (7 days from sent)';
COMMENT ON COLUMN parents.invitation_accepted_at IS 'Timestamp when parent completed registration via invitation';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate and set invitation token
CREATE OR REPLACE FUNCTION generate_parent_invitation(parent_id UUID)
RETURNS UUID AS $$
DECLARE
    new_token UUID;
BEGIN
    new_token := gen_random_uuid();

    UPDATE parents
    SET
        invitation_token = new_token,
        invitation_sent_at = NOW(),
        invitation_expires_at = NOW() + INTERVAL '7 days'
    WHERE id = parent_id AND user_id IS NULL;

    RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate invitation token
CREATE OR REPLACE FUNCTION validate_invitation_token(token UUID)
RETURNS TABLE(
    parent_id UUID,
    email TEXT,
    name TEXT,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.name,
        CASE
            WHEN p.id IS NULL THEN FALSE
            WHEN p.user_id IS NOT NULL THEN FALSE
            WHEN p.invitation_expires_at < NOW() THEN FALSE
            ELSE TRUE
        END AS is_valid,
        CASE
            WHEN p.id IS NULL THEN 'Invalid invitation token'
            WHEN p.user_id IS NOT NULL THEN 'Account already activated'
            WHEN p.invitation_expires_at < NOW() THEN 'Invitation has expired'
            ELSE NULL
        END AS error_message
    FROM parents p
    WHERE p.invitation_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark invitation as accepted (called after successful registration)
CREATE OR REPLACE FUNCTION accept_parent_invitation(token UUID, auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE parents
    SET
        user_id = auth_user_id,
        invitation_accepted_at = NOW(),
        updated_at = NOW()
    WHERE invitation_token = token
      AND user_id IS NULL
      AND invitation_expires_at > NOW();

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE HANDLE_NEW_USER TRIGGER TO CHECK INVITATION TOKEN
-- ============================================================================

-- Update the trigger to also check for invitation token in user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_parent_id UUID;
    invitation_token_value UUID;
BEGIN
    -- Check if there's an invitation token in the user metadata
    invitation_token_value := (NEW.raw_user_meta_data->>'invitation_token')::UUID;

    -- First, try to find by invitation token if provided
    IF invitation_token_value IS NOT NULL THEN
        SELECT id INTO existing_parent_id
        FROM public.parents
        WHERE invitation_token = invitation_token_value
          AND user_id IS NULL
          AND invitation_expires_at > NOW();

        IF existing_parent_id IS NOT NULL THEN
            -- Link the existing parent record to this auth user via invitation
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
    SELECT id INTO existing_parent_id
    FROM public.parents
    WHERE email = NEW.email AND user_id IS NULL;

    IF existing_parent_id IS NOT NULL THEN
        -- Link the existing parent record to this auth user
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
        -- This handles the case of a completely new user signing up
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
-- RLS POLICIES FOR INVITATION FUNCTIONS
-- ============================================================================

-- Allow tutors to generate invitations for parents they manage
-- (Parents are implicitly managed by the tutor who created them)

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_parent_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_invitation_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_parent_invitation(UUID, UUID) TO authenticated;
