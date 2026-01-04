-- Migration: Parent Onboarding Support
-- Version: 20260103000002
-- Description: Adds columns to track parent onboarding status and preferences

-- ============================================================================
-- ADD ONBOARDING TRACKING COLUMNS
-- ============================================================================

-- Track when onboarding was completed (NULL = not completed)
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Store parent preferences as JSONB for flexibility
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
    "notifications": {
        "lesson_reminders": true,
        "lesson_reminders_hours_before": 24,
        "worksheet_assigned": true,
        "payment_due": true,
        "lesson_notes": true
    },
    "contact_preference": "email"
}'::jsonb;

-- Add index for onboarding status queries
CREATE INDEX IF NOT EXISTS idx_parents_onboarding_status
ON parents ((onboarding_completed_at IS NULL))
WHERE role = 'parent';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN parents.onboarding_completed_at IS
'Timestamp when parent completed onboarding. NULL means onboarding not yet completed.';

COMMENT ON COLUMN parents.preferences IS
'Parent preferences stored as JSONB. Includes notification settings and contact preferences.';

-- ============================================================================
-- HELPER FUNCTION: Check if parent needs onboarding
-- ============================================================================

CREATE OR REPLACE FUNCTION public.parent_needs_onboarding(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM parents
        WHERE user_id = p_user_id
        AND role = 'parent'
        AND onboarding_completed_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Complete parent onboarding
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_parent_onboarding(
    p_user_id UUID,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_preferences JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_parent_id UUID;
BEGIN
    -- Get the parent ID
    SELECT id INTO v_parent_id
    FROM parents
    WHERE user_id = p_user_id;

    IF v_parent_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Update the parent record
    UPDATE parents
    SET
        name = COALESCE(p_name, name),
        phone = COALESCE(p_phone, phone),
        preferences = COALESCE(p_preferences, preferences),
        onboarding_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_parent_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICY: Allow parents to update their own onboarding status
-- ============================================================================

-- Parents can update their own preferences and onboarding status
DROP POLICY IF EXISTS "Parents can update own onboarding" ON parents;

CREATE POLICY "Parents can update own onboarding"
    ON parents FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
