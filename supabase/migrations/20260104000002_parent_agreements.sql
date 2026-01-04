-- Migration: Parent Agreements / Digital Signature System
-- Version: 20260104000002
-- Description: Adds parent agreement tracking with digital signatures

-- ============================================================================
-- CREATE PARENT_AGREEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS parent_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,

    -- Agreement versioning
    agreement_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    agreement_type VARCHAR(50) NOT NULL DEFAULT 'tutoring_services',

    -- Agreement content
    agreement_content TEXT NOT NULL,

    -- Digital signature data
    signature_data TEXT, -- Base64 encoded signature image
    signature_timestamp TIMESTAMPTZ,
    signed_by_name VARCHAR(255), -- Name as typed/verified
    signed_by_email VARCHAR(255),

    -- Device/session info for audit
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired', 'revoked')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    -- PDF storage reference (if generated)
    pdf_storage_path TEXT,
    pdf_generated_at TIMESTAMPTZ
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_parent_agreements_parent_id ON parent_agreements(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_agreements_status ON parent_agreements(status);
CREATE INDEX IF NOT EXISTS idx_parent_agreements_version ON parent_agreements(agreement_version);

-- Add comments for clarity
COMMENT ON TABLE parent_agreements IS 'Stores parent agreement/contract records with digital signatures';
COMMENT ON COLUMN parent_agreements.signature_data IS 'Base64 encoded PNG image of the signature';
COMMENT ON COLUMN parent_agreements.agreement_content IS 'Full text of the agreement at time of signing';
COMMENT ON COLUMN parent_agreements.device_info IS 'JSON containing device details for audit trail';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a new agreement for a parent
CREATE OR REPLACE FUNCTION create_parent_agreement(
    p_parent_id UUID,
    p_agreement_content TEXT,
    p_agreement_version VARCHAR(20) DEFAULT '1.0',
    p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services',
    p_expires_in_days INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
    new_agreement_id UUID;
BEGIN
    INSERT INTO parent_agreements (
        parent_id,
        agreement_content,
        agreement_version,
        agreement_type,
        expires_at
    ) VALUES (
        p_parent_id,
        p_agreement_content,
        p_agreement_version,
        p_agreement_type,
        CASE WHEN p_expires_in_days > 0 THEN NOW() + (p_expires_in_days || ' days')::INTERVAL ELSE NULL END
    )
    RETURNING id INTO new_agreement_id;

    RETURN new_agreement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sign an agreement with digital signature
CREATE OR REPLACE FUNCTION sign_parent_agreement(
    p_agreement_id UUID,
    p_signature_data TEXT,
    p_signed_by_name VARCHAR(255),
    p_signed_by_email VARCHAR(255),
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE parent_agreements
    SET
        signature_data = p_signature_data,
        signature_timestamp = NOW(),
        signed_by_name = p_signed_by_name,
        signed_by_email = p_signed_by_email,
        ip_address = p_ip_address,
        user_agent = p_user_agent,
        device_info = p_device_info,
        status = 'signed',
        updated_at = NOW()
    WHERE id = p_agreement_id
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW());

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if parent has a valid signed agreement
CREATE OR REPLACE FUNCTION has_valid_agreement(p_parent_id UUID, p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services')
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM parent_agreements
        WHERE parent_id = p_parent_id
          AND agreement_type = p_agreement_type
          AND status = 'signed'
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the latest agreement for a parent
CREATE OR REPLACE FUNCTION get_parent_agreement(p_parent_id UUID, p_agreement_type VARCHAR(50) DEFAULT 'tutoring_services')
RETURNS TABLE(
    agreement_id UUID,
    agreement_version VARCHAR(20),
    status VARCHAR(20),
    signed_at TIMESTAMPTZ,
    signed_by_name VARCHAR(255),
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pa.id,
        pa.agreement_version,
        pa.status,
        pa.signature_timestamp,
        pa.signed_by_name,
        pa.expires_at
    FROM parent_agreements pa
    WHERE pa.parent_id = p_parent_id
      AND pa.agreement_type = p_agreement_type
    ORDER BY pa.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ADD AGREEMENT STATUS TO PARENTS TABLE
-- ============================================================================

-- Add column to track if parent needs to sign agreement
ALTER TABLE parents
ADD COLUMN IF NOT EXISTS requires_agreement BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN parents.requires_agreement IS 'Whether parent needs to sign the service agreement';
COMMENT ON COLUMN parents.agreement_signed_at IS 'Timestamp when the latest agreement was signed';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on parent_agreements
ALTER TABLE parent_agreements ENABLE ROW LEVEL SECURITY;

-- Parents can view their own agreements
CREATE POLICY "Parents can view own agreements"
    ON parent_agreements
    FOR SELECT
    USING (
        parent_id IN (
            SELECT id FROM parents WHERE user_id = auth.uid()
        )
    );

-- Parents can update (sign) their own pending agreements
CREATE POLICY "Parents can sign own agreements"
    ON parent_agreements
    FOR UPDATE
    USING (
        parent_id IN (
            SELECT id FROM parents WHERE user_id = auth.uid()
        )
        AND status = 'pending'
    )
    WITH CHECK (
        parent_id IN (
            SELECT id FROM parents WHERE user_id = auth.uid()
        )
    );

-- Tutors can view all agreements (for their students' parents)
CREATE POLICY "Tutors can view all agreements"
    ON parent_agreements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM parents
            WHERE parents.user_id = auth.uid()
            AND parents.role = 'tutor'
        )
    );

-- Tutors can create agreements for parents
CREATE POLICY "Tutors can create agreements"
    ON parent_agreements
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM parents
            WHERE parents.user_id = auth.uid()
            AND parents.role = 'tutor'
        )
    );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_parent_agreement(UUID, TEXT, VARCHAR, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION sign_parent_agreement(UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION has_valid_agreement(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_parent_agreement(UUID, VARCHAR) TO authenticated;

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_parent_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_parent_agreements_updated_at
    BEFORE UPDATE ON parent_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_agreements_updated_at();

-- ============================================================================
-- UPDATE PARENT AGREEMENT STATUS TRIGGER
-- ============================================================================

-- Trigger to update parent's agreement_signed_at when agreement is signed
CREATE OR REPLACE FUNCTION update_parent_agreement_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'signed' AND OLD.status = 'pending' THEN
        UPDATE parents
        SET agreement_signed_at = NEW.signature_timestamp
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parent_agreement_status
    AFTER UPDATE ON parent_agreements
    FOR EACH ROW
    WHEN (NEW.status = 'signed' AND OLD.status = 'pending')
    EXECUTE FUNCTION update_parent_agreement_status();
