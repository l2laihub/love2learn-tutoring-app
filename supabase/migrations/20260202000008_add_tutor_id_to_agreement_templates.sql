-- Migration: Add tutor_id to agreement_templates for multi-tutor support
-- Version: 20260202000008
-- Description: Each tutor should have their own agreement templates.
--              This migration adds tutor_id column and updates RLS policies.

-- ============================================================================
-- ADD TUTOR_ID COLUMN TO AGREEMENT_TEMPLATES
-- ============================================================================

-- Add the tutor_id column
ALTER TABLE agreement_templates
ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES parents(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_agreement_templates_tutor_id
ON agreement_templates(tutor_id);

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Find the original tutor and assign all existing templates to them
DO $$
DECLARE
    v_original_tutor_id UUID;
BEGIN
    -- Find the original tutor (the one with most data)
    SELECT p.id INTO v_original_tutor_id
    FROM parents p
    WHERE p.role = 'tutor'
    AND EXISTS (SELECT 1 FROM students s WHERE s.tutor_id = p.id)
    ORDER BY (SELECT COUNT(*) FROM students WHERE tutor_id = p.id) DESC
    LIMIT 1;

    -- Fallback: oldest tutor
    IF v_original_tutor_id IS NULL THEN
        SELECT id INTO v_original_tutor_id
        FROM parents WHERE role = 'tutor'
        ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- Assign all existing templates to original tutor
    IF v_original_tutor_id IS NOT NULL THEN
        UPDATE agreement_templates
        SET tutor_id = v_original_tutor_id
        WHERE tutor_id IS NULL;

        RAISE NOTICE 'Assigned templates to tutor: %', v_original_tutor_id;
    END IF;
END $$;

-- ============================================================================
-- UPDATE RLS POLICIES
-- ============================================================================

-- Drop old policies that allow any tutor to see all templates
DROP POLICY IF EXISTS "Tutors can view agreement templates" ON agreement_templates;
DROP POLICY IF EXISTS "Tutors can manage agreement templates" ON agreement_templates;

-- Tutors can only view their own templates
CREATE POLICY "Tutors can view agreement templates"
ON agreement_templates
FOR SELECT
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
);

-- Tutors can manage their own templates
CREATE POLICY "Tutors can manage agreement templates"
ON agreement_templates
FOR ALL
TO authenticated
USING (
    is_tutor() AND tutor_id = get_current_tutor_id()
)
WITH CHECK (
    is_tutor() AND (tutor_id = get_current_tutor_id() OR tutor_id IS NULL)
);

-- ============================================================================
-- UPDATE FUNCTIONS
-- ============================================================================

-- Update save_agreement_template to auto-set tutor_id
CREATE OR REPLACE FUNCTION save_agreement_template(
    p_name VARCHAR(100),
    p_version VARCHAR(20),
    p_content TEXT,
    p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services',
    p_set_active BOOLEAN DEFAULT FALSE,
    p_set_default BOOLEAN DEFAULT FALSE,
    p_admin_user_id UUID DEFAULT NULL,
    p_template_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_template_id UUID;
    v_tutor_id UUID;
BEGIN
    -- Get current tutor's ID
    v_tutor_id := get_current_tutor_id();

    IF v_tutor_id IS NULL THEN
        RAISE EXCEPTION 'No tutor context - cannot save template';
    END IF;

    IF p_template_id IS NOT NULL THEN
        -- Update existing template (only if owned by this tutor)
        UPDATE agreement_templates
        SET
            name = p_name,
            version = p_version,
            content = p_content,
            is_active = p_set_active,
            updated_at = NOW(),
            published_at = CASE WHEN p_set_active THEN NOW() ELSE published_at END
        WHERE id = p_template_id
          AND tutor_id = v_tutor_id
        RETURNING id INTO v_template_id;

        IF v_template_id IS NULL THEN
            RAISE EXCEPTION 'Template not found or not owned by current tutor';
        END IF;
    ELSE
        -- Create new template with tutor_id
        INSERT INTO agreement_templates (
            name, version, content, agreement_type,
            is_active, is_default, created_by, tutor_id
        ) VALUES (
            p_name, p_version, p_content, p_agreement_type,
            p_set_active, p_set_default, p_admin_user_id, v_tutor_id
        )
        RETURNING id INTO v_template_id;
    END IF;

    -- If setting as default, unset other defaults FOR THIS TUTOR ONLY
    IF p_set_default THEN
        UPDATE agreement_templates
        SET is_default = FALSE
        WHERE agreement_type = p_agreement_type
          AND tutor_id = v_tutor_id
          AND id != v_template_id
          AND is_default = TRUE;

        UPDATE agreement_templates
        SET is_default = TRUE
        WHERE id = v_template_id;
    END IF;

    -- Log the action
    IF p_admin_user_id IS NOT NULL THEN
        INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, details)
        VALUES (
            p_admin_user_id,
            CASE WHEN p_template_id IS NOT NULL THEN 'update_template' ELSE 'create_template' END,
            'agreement_template',
            v_template_id,
            jsonb_build_object(
                'name', p_name,
                'version', p_version,
                'is_active', p_set_active,
                'is_default', p_set_default,
                'tutor_id', v_tutor_id
            )
        );
    END IF;

    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_active_agreement_template to filter by tutor
CREATE OR REPLACE FUNCTION get_active_agreement_template(
    p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services'
)
RETURNS TABLE(
    template_id UUID,
    template_name VARCHAR(100),
    template_version VARCHAR(20),
    template_content TEXT
) AS $$
DECLARE
    v_tutor_id UUID;
BEGIN
    v_tutor_id := get_current_tutor_id();

    RETURN QUERY
    SELECT
        at.id,
        at.name,
        at.version,
        at.content
    FROM agreement_templates at
    WHERE at.agreement_type = p_agreement_type
      AND at.is_active = TRUE
      AND at.is_default = TRUE
      AND at.tutor_id = v_tutor_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADD TRIGGER FOR AUTO-SETTING TUTOR_ID
-- ============================================================================

CREATE OR REPLACE FUNCTION set_agreement_template_tutor_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tutor_id IS NULL THEN
        NEW.tutor_id := get_current_tutor_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_agreement_template_tutor_id ON agreement_templates;
CREATE TRIGGER trigger_set_agreement_template_tutor_id
    BEFORE INSERT ON agreement_templates
    FOR EACH ROW
    EXECUTE FUNCTION set_agreement_template_tutor_id();

-- ============================================================================
-- UPDATE UNIQUE CONSTRAINT TO BE PER-TUTOR
-- ============================================================================

-- Drop old constraint (version unique per type across ALL tutors)
ALTER TABLE agreement_templates
DROP CONSTRAINT IF EXISTS unique_version_per_type;

-- Add new constraint (version unique per type PER TUTOR)
ALTER TABLE agreement_templates
ADD CONSTRAINT unique_version_per_type_per_tutor
UNIQUE (tutor_id, agreement_type, version);

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON COLUMN agreement_templates.tutor_id IS 'The tutor who owns this template';
