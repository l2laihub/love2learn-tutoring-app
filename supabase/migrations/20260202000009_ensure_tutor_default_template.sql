-- Migration: Ensure each tutor has a default agreement template
-- Version: 20260202000009
-- Description: Creates a function to provision default templates for tutors,
--              and ensures all existing tutors have one.

-- ============================================================================
-- FUNCTION TO ENSURE TUTOR HAS DEFAULT TEMPLATE
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_tutor_has_default_template(
    p_tutor_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tutor_id UUID;
    v_template_id UUID;
    v_default_content TEXT;
BEGIN
    -- Use provided tutor_id or current tutor
    v_tutor_id := COALESCE(p_tutor_id, get_current_tutor_id());

    IF v_tutor_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Check if tutor already has a default template
    SELECT id INTO v_template_id
    FROM agreement_templates
    WHERE tutor_id = v_tutor_id
      AND agreement_type = 'tutoring_services'
      AND is_default = TRUE
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
        -- Tutor already has a default template
        RETURN v_template_id;
    END IF;

    -- Default template content
    v_default_content := 'TUTORING SERVICES AGREEMENT

This Tutoring Services Agreement ("Agreement") is entered into between the Tutor ("Tutor") and the undersigned parent/guardian ("Parent").

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

11. DIGITAL SIGNATURE ACKNOWLEDGMENT

11.1 Parent acknowledges that electronic signatures on this Agreement are legally binding.

11.2 By providing a digital signature below, Parent confirms they have read, understood, and agree to all terms of this Agreement.

12. GENERAL PROVISIONS

12.1 This Agreement constitutes the entire agreement between the parties.

12.2 Any modifications must be in writing and agreed upon by both parties.

12.3 This Agreement shall be governed by the laws of the state in which services are provided.';

    -- Create default template for this tutor
    INSERT INTO agreement_templates (
        name, version, content, agreement_type,
        is_active, is_default, tutor_id
    ) VALUES (
        'Default Tutoring Services Agreement',
        '1.0',
        v_default_content,
        'tutoring_services',
        TRUE,
        TRUE,
        v_tutor_id
    )
    RETURNING id INTO v_template_id;

    RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ensure_tutor_has_default_template(UUID) TO authenticated;

-- ============================================================================
-- PROVISION DEFAULT TEMPLATES FOR ALL EXISTING TUTORS
-- ============================================================================

DO $$
DECLARE
    v_tutor RECORD;
    v_created_count INTEGER := 0;
BEGIN
    -- Loop through all tutors
    FOR v_tutor IN
        SELECT id, name, email
        FROM parents
        WHERE role = 'tutor'
    LOOP
        -- Check if this tutor has a default template
        IF NOT EXISTS (
            SELECT 1 FROM agreement_templates
            WHERE tutor_id = v_tutor.id
              AND agreement_type = 'tutoring_services'
              AND is_default = TRUE
        ) THEN
            -- Create one
            PERFORM ensure_tutor_has_default_template(v_tutor.id);
            v_created_count := v_created_count + 1;
            RAISE NOTICE 'Created default template for tutor: % (%)', v_tutor.name, v_tutor.email;
        END IF;
    END LOOP;

    RAISE NOTICE 'Created % default templates', v_created_count;
END $$;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON FUNCTION ensure_tutor_has_default_template(UUID) IS
'Ensures a tutor has a default agreement template. Creates one if not exists. Returns template ID.';
