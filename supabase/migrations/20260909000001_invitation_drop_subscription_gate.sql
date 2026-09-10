-- Migration: Stop blocking parent invitations on tutor subscription status
-- Version: 20260909000001
--
-- Problem: validate_invitation_token() (added in 20260201000006) refuses any
-- invitation whose tutor fails is_subscription_active(), answering
-- "This invitation is no longer valid - please contact your tutor".
--
-- The paywall that check enforces is not shipped: EXPO_PUBLIC_ENABLE_PAYWALL
-- defaults to false, so no tutor is ever shown a trial-expiry warning, a
-- checkout, or any way to become "active". Every tutor's trial lapsed in
-- February 2026, which silently killed *every* parent invitation in the app --
-- the invitation itself is fine (unexpired, unused, tutor linked), the parent
-- just hits a dead end and the tutor is never told.
--
-- Fix: drop the blocking branch. tutor_subscription_active is still returned so
-- the paywall can gate on it when it actually ships -- but the gate must land
-- together with tutor-facing expiry warnings, not before them.
--
-- Return type is unchanged, so no DROP FUNCTION is needed.

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
        SELECT t.id, t.business_name, t.name
        INTO v_tutor
        FROM parents t
        WHERE t.id = v_parent.tutor_id AND t.role = 'tutor';

        IF FOUND THEN
            -- Subscription state is reported, never enforced here.
            -- ponytail: re-gate on this only when the paywall ships with
            -- tutor-facing expiry warnings.
            RETURN QUERY SELECT
                v_parent.id,
                v_parent.email,
                v_parent.name,
                v_parent.tutor_id,
                v_tutor.business_name,
                v_tutor.name,
                is_subscription_active(v_parent.tutor_id),
                TRUE,
                NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Valid invitation but no tutor linked (legacy case)
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

COMMENT ON FUNCTION validate_invitation_token(UUID) IS 'Validates an invitation token and returns parent and tutor info. Reports tutor subscription status but does not gate on it.';

GRANT EXECUTE ON FUNCTION validate_invitation_token(UUID) TO anon, authenticated;

-- ============================================================================
-- SELF-CHECK
-- ============================================================================
-- Builds a tutor with a long-lapsed trial plus a pending invitation, asserts
-- the invitation validates, then rolls the fixture back via a subtransaction.
-- Fails the migration if the subscription gate ever comes back.

DO $check$
DECLARE
    v_tutor_id  UUID := gen_random_uuid();
    v_parent_id UUID := gen_random_uuid();
    v_token     UUID := gen_random_uuid();
    v_result    RECORD;
BEGIN
    BEGIN
        INSERT INTO parents (id, email, name, role, subscription_status, trial_ends_at)
        VALUES (v_tutor_id, 'selfcheck-tutor-' || v_tutor_id || '@invalid.test',
                'Self Check Tutor', 'tutor', 'trialing', NOW() - INTERVAL '180 days');

        INSERT INTO parents (id, email, name, role, tutor_id, invitation_token, invitation_expires_at)
        VALUES (v_parent_id, 'selfcheck-parent-' || v_parent_id || '@invalid.test',
                'Self Check Parent', 'parent', v_tutor_id, v_token, NOW() + INTERVAL '7 days');

        SELECT * INTO v_result FROM validate_invitation_token(v_token);

        IF NOT v_result.is_valid THEN
            RAISE EXCEPTION 'self-check failed: lapsed-trial tutor still blocks invitations (%)',
                COALESCE(v_result.error_message, '<no message>');
        END IF;

        IF v_result.tutor_subscription_active THEN
            RAISE EXCEPTION 'self-check failed: expected tutor_subscription_active = false';
        END IF;

        IF v_result.tutor_id IS DISTINCT FROM v_tutor_id THEN
            RAISE EXCEPTION 'self-check failed: tutor_id not returned';
        END IF;

        -- Unwind the fixture.
        RAISE EXCEPTION 'SELFCHECK_ROLLBACK';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM = 'SELFCHECK_ROLLBACK' THEN
                RAISE NOTICE 'validate_invitation_token self-check passed';
            ELSE
                RAISE;
            END IF;
    END;
END
$check$;
