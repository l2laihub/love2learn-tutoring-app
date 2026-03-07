-- Migration: Allow re-sending parent invitations
-- Adds a function that can regenerate invitation tokens for parents
-- who may already have a user_id (e.g., after onboarding reset)

CREATE OR REPLACE FUNCTION regenerate_parent_invitation(parent_id UUID)
RETURNS UUID AS $$
DECLARE
    new_token UUID;
BEGIN
    new_token := gen_random_uuid();

    UPDATE parents
    SET
        invitation_token = new_token,
        invitation_sent_at = NOW(),
        invitation_expires_at = NOW() + INTERVAL '7 days',
        invitation_accepted_at = NULL
    WHERE id = parent_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent not found: %', parent_id;
    END IF;

    RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
