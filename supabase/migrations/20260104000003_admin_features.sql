-- Migration: Admin Panel Features
-- Version: 20260104000003
-- Description: Adds admin features including reset onboarding, agreement templates, and audit log

-- ============================================================================
-- AGREEMENT TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Template identification
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    agreement_type VARCHAR(50) NOT NULL DEFAULT 'tutoring_services',

    -- Template content
    content TEXT NOT NULL,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    -- Version uniqueness per type
    CONSTRAINT unique_version_per_type UNIQUE (agreement_type, version)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_agreement_templates_type_active
    ON agreement_templates(agreement_type, is_active);
CREATE INDEX IF NOT EXISTS idx_agreement_templates_default
    ON agreement_templates(agreement_type) WHERE is_default = TRUE;

-- Comments
COMMENT ON TABLE agreement_templates IS 'Stores versioned agreement templates that can be edited by admin';
COMMENT ON COLUMN agreement_templates.is_active IS 'Whether this template is currently being used for new agreements';
COMMENT ON COLUMN agreement_templates.is_default IS 'Whether this is the default template for its type';

-- ============================================================================
-- ADMIN AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who performed the action
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),

    -- What action was performed
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'parent', 'agreement', 'template', etc.
    entity_id UUID,

    -- Action details
    details JSONB,

    -- When
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying audit log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS 'Tracks all admin actions for accountability';

-- ============================================================================
-- RESET PARENT ONBOARDING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_parent_onboarding(
    p_parent_id UUID,
    p_admin_user_id UUID DEFAULT NULL,
    p_revoke_agreements BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Reset parent's onboarding status
    UPDATE parents
    SET
        onboarding_completed_at = NULL,
        requires_agreement = TRUE,
        agreement_signed_at = NULL,
        updated_at = NOW()
    WHERE id = p_parent_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    IF affected_rows = 0 THEN
        RETURN FALSE;
    END IF;

    -- Optionally revoke existing agreements
    IF p_revoke_agreements THEN
        UPDATE parent_agreements
        SET
            status = 'revoked',
            updated_at = NOW()
        WHERE parent_id = p_parent_id
          AND status = 'signed';
    END IF;

    -- Log the action if admin user provided
    IF p_admin_user_id IS NOT NULL THEN
        INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, details)
        VALUES (
            p_admin_user_id,
            'reset_onboarding',
            'parent',
            p_parent_id,
            jsonb_build_object(
                'revoke_agreements', p_revoke_agreements,
                'timestamp', NOW()
            )
        );
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GET ACTIVE AGREEMENT TEMPLATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_agreement_template(
    p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services'
)
RETURNS TABLE(
    template_id UUID,
    template_name VARCHAR(100),
    template_version VARCHAR(20),
    template_content TEXT
) AS $$
BEGIN
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
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE/UPDATE AGREEMENT TEMPLATE FUNCTION
-- ============================================================================

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
BEGIN
    IF p_template_id IS NOT NULL THEN
        -- Update existing template
        UPDATE agreement_templates
        SET
            name = p_name,
            version = p_version,
            content = p_content,
            is_active = p_set_active,
            updated_at = NOW(),
            published_at = CASE WHEN p_set_active THEN NOW() ELSE published_at END
        WHERE id = p_template_id
        RETURNING id INTO v_template_id;
    ELSE
        -- Create new template
        INSERT INTO agreement_templates (
            name, version, content, agreement_type,
            is_active, is_default, created_by
        ) VALUES (
            p_name, p_version, p_content, p_agreement_type,
            p_set_active, p_set_default, p_admin_user_id
        )
        RETURNING id INTO v_template_id;
    END IF;

    -- If setting as default, unset other defaults
    IF p_set_default THEN
        UPDATE agreement_templates
        SET is_default = FALSE
        WHERE agreement_type = p_agreement_type
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
                'is_default', p_set_default
            )
        );
    END IF;

    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GET ADMIN DASHBOARD STATS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(
    total_parents BIGINT,
    active_parents BIGINT,
    pending_agreements BIGINT,
    signed_agreements BIGINT,
    total_students BIGINT,
    pending_invitations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM parents WHERE role = 'parent')::BIGINT as total_parents,
        (SELECT COUNT(*) FROM parents WHERE role = 'parent' AND user_id IS NOT NULL)::BIGINT as active_parents,
        (SELECT COUNT(*) FROM parent_agreements WHERE status = 'pending')::BIGINT as pending_agreements,
        (SELECT COUNT(*) FROM parent_agreements WHERE status = 'signed')::BIGINT as signed_agreements,
        (SELECT COUNT(*) FROM students)::BIGINT as total_students,
        (SELECT COUNT(*) FROM parents
         WHERE role = 'parent'
           AND user_id IS NULL
           AND invitation_sent_at IS NOT NULL
           AND (invitation_expires_at IS NULL OR invitation_expires_at > NOW()))::BIGINT as pending_invitations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Agreement templates - only tutors can view/edit
CREATE POLICY "Tutors can view agreement templates"
    ON agreement_templates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents
            WHERE parents.user_id = auth.uid()
            AND parents.role = 'tutor'
        )
    );

CREATE POLICY "Tutors can manage agreement templates"
    ON agreement_templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM parents
            WHERE parents.user_id = auth.uid()
            AND parents.role = 'tutor'
        )
    );

-- Audit log - only tutors can view
CREATE POLICY "Tutors can view audit log"
    ON admin_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents
            WHERE parents.user_id = auth.uid()
            AND parents.role = 'tutor'
        )
    );

CREATE POLICY "System can insert audit log"
    ON admin_audit_log
    FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION reset_parent_onboarding(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_agreement_template(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION save_agreement_template(VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN, BOOLEAN, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;

-- ============================================================================
-- INSERT DEFAULT AGREEMENT TEMPLATE
-- ============================================================================

-- Only insert if no templates exist for this type
INSERT INTO agreement_templates (name, version, agreement_type, content, is_active, is_default)
SELECT
    'Default Tutoring Services Agreement',
    '1.0',
    'tutoring_services',
    'TUTORING SERVICES AGREEMENT

This Tutoring Services Agreement ("Agreement") is entered into between Love to Learn Academy ("Tutor/Academy") and the undersigned parent/guardian ("Parent").

1. SERVICES

1.1 The Tutor agrees to provide educational tutoring services to the Parent''s child(ren) as specified during enrollment.

1.2 Tutoring sessions will be conducted at mutually agreed upon times and locations (in-person or online).

1.3 Session duration, frequency, and subject matter will be as agreed upon between the Tutor and Parent.

2. PAYMENT TERMS

2.1 Payment for tutoring services is due according to the schedule agreed upon during enrollment.

2.2 Rates may be adjusted with 30 days'' written notice.

2.3 Payment methods accepted: Cash, Check, Venmo, Zelle, or other agreed methods.

3. CANCELLATION POLICY

3.1 Parents must provide at least 24 hours'' notice for session cancellations.

3.2 Sessions cancelled with less than 24 hours'' notice may be charged at the full session rate.

3.3 The Tutor will make reasonable efforts to reschedule cancelled sessions.

4. ATTENDANCE & PUNCTUALITY

4.1 Students are expected to attend all scheduled sessions.

4.2 If a student is more than 15 minutes late without notice, the session may be shortened or cancelled.

4.3 Chronic lateness or no-shows may result in termination of services.

5. MATERIALS & RESOURCES

5.1 The Tutor will provide appropriate learning materials, worksheets, and resources.

5.2 Any additional materials requiring purchase will be discussed with the Parent in advance.

5.3 Digital materials provided are for personal educational use only and may not be redistributed.

6. PROGRESS & COMMUNICATION

6.1 The Tutor will provide regular updates on student progress through the Parent Portal.

6.2 Parents are encouraged to communicate any concerns or questions.

6.3 Progress reports will be shared as appropriate for the tutoring arrangement.

7. CONFIDENTIALITY

7.1 All student information will be kept confidential and used only for educational purposes.

7.2 Student progress information may be shared with parents/guardians and, if applicable, school personnel with consent.

8. SAFETY & CONDUCT

8.1 A safe, respectful learning environment will be maintained at all times.

8.2 Any behavioral issues will be addressed promptly with the Parent.

8.3 The Tutor reserves the right to terminate services for severe or persistent misconduct.

9. LIMITATION OF LIABILITY

9.1 While the Tutor will make best efforts to help students succeed, no specific academic outcomes are guaranteed.

9.2 The Tutor is not responsible for students'' academic performance outside of tutoring sessions.

10. TERMINATION

10.1 Either party may terminate this Agreement with 7 days'' written notice.

10.2 The Tutor may terminate immediately for non-payment, misconduct, or other serious breaches.

10.3 Upon termination, any outstanding balances must be paid in full.

11. PHOTO/VIDEO CONSENT

11.1 By signing this Agreement, Parent consents to occasional photos or videos of tutoring sessions for educational documentation purposes only.

11.2 No photos or videos will be shared publicly without additional written consent.

12. DIGITAL SIGNATURE ACKNOWLEDGMENT

12.1 Parent acknowledges that electronic signatures on this Agreement are legally binding.

12.2 By providing a digital signature below, Parent confirms they have read, understood, and agree to all terms of this Agreement.

13. GENERAL PROVISIONS

13.1 This Agreement constitutes the entire agreement between the parties.

13.2 Any modifications must be in writing and agreed upon by both parties.

13.3 This Agreement shall be governed by the laws of the state in which services are provided.',
    TRUE,
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM agreement_templates
    WHERE agreement_type = 'tutoring_services' AND version = '1.0'
);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_agreement_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agreement_templates_updated_at
    BEFORE UPDATE ON agreement_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_agreement_templates_updated_at();
