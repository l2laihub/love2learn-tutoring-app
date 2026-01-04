/**
 * useParentAgreement Hook
 * Manages parent agreement/contract data and digital signatures
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAgreementText, AGREEMENT_VERSION } from '../components/AgreementContent';
import { Platform } from 'react-native';

export interface Agreement {
  id: string;
  parentId: string;
  agreementVersion: string;
  agreementType: string;
  agreementContent: string;
  signatureData: string | null;
  signatureTimestamp: string | null;
  signedByName: string | null;
  signedByEmail: string | null;
  status: 'pending' | 'signed' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string | null;
  pdfStoragePath: string | null;
}

export interface SignAgreementParams {
  agreementId: string;
  signatureData: string;
  signedByName: string;
  signedByEmail: string;
}

export interface CreateAgreementParams {
  parentId: string;
  agreementType?: string;
  agreementVersion?: string;
  expiresInDays?: number;
}

interface UseParentAgreementResult {
  loading: boolean;
  error: string | null;
  agreement: Agreement | null;

  // Check if parent has valid agreement
  checkAgreementStatus: (parentId: string) => Promise<boolean>;

  // Get current agreement for parent
  getAgreement: (parentId: string) => Promise<Agreement | null>;

  // Create a new agreement for a parent
  createAgreement: (params: CreateAgreementParams) => Promise<Agreement | null>;

  // Sign an agreement
  signAgreement: (params: SignAgreementParams) => Promise<boolean>;

  // Get agreement by ID
  getAgreementById: (agreementId: string) => Promise<Agreement | null>;

  // Clear error
  clearError: () => void;
}

/**
 * Get device information for audit trail
 */
const getDeviceInfo = (): Record<string, string> => {
  return {
    platform: Platform.OS,
    version: Platform.Version?.toString() || 'unknown',
    timestamp: new Date().toISOString(),
  };
};

/**
 * Hook for managing parent agreements
 */
export function useParentAgreement(): UseParentAgreementResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check if parent has a valid signed agreement
   */
  const checkAgreementStatus = useCallback(async (parentId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('has_valid_agreement', {
        p_parent_id: parentId,
        p_agreement_type: 'tutoring_services',
      });

      if (rpcError) {
        console.error('Error checking agreement status:', rpcError);
        throw new Error(rpcError.message);
      }

      return data === true;
    } catch (err: any) {
      console.error('Error in checkAgreementStatus:', err);
      setError(err.message || 'Failed to check agreement status');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get the current/latest agreement for a parent
   */
  const getAgreement = useCallback(async (parentId: string): Promise<Agreement | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('parent_agreements')
        .select('*')
        .eq('parent_id', parentId)
        .eq('agreement_type', 'tutoring_services')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (queryError) {
        if (queryError.code === 'PGRST116') {
          // No agreement found - not an error
          return null;
        }
        console.error('Error fetching agreement:', queryError);
        throw new Error(queryError.message);
      }

      const agreementData: Agreement = {
        id: data.id,
        parentId: data.parent_id,
        agreementVersion: data.agreement_version,
        agreementType: data.agreement_type,
        agreementContent: data.agreement_content,
        signatureData: data.signature_data,
        signatureTimestamp: data.signature_timestamp,
        signedByName: data.signed_by_name,
        signedByEmail: data.signed_by_email,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        pdfStoragePath: data.pdf_storage_path,
      };

      setAgreement(agreementData);
      return agreementData;
    } catch (err: any) {
      console.error('Error in getAgreement:', err);
      setError(err.message || 'Failed to fetch agreement');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get agreement by ID
   */
  const getAgreementById = useCallback(async (agreementId: string): Promise<Agreement | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('parent_agreements')
        .select('*')
        .eq('id', agreementId)
        .single();

      if (queryError) {
        console.error('Error fetching agreement by ID:', queryError);
        throw new Error(queryError.message);
      }

      const agreementData: Agreement = {
        id: data.id,
        parentId: data.parent_id,
        agreementVersion: data.agreement_version,
        agreementType: data.agreement_type,
        agreementContent: data.agreement_content,
        signatureData: data.signature_data,
        signatureTimestamp: data.signature_timestamp,
        signedByName: data.signed_by_name,
        signedByEmail: data.signed_by_email,
        status: data.status,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        pdfStoragePath: data.pdf_storage_path,
      };

      setAgreement(agreementData);
      return agreementData;
    } catch (err: any) {
      console.error('Error in getAgreementById:', err);
      setError(err.message || 'Failed to fetch agreement');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new agreement for a parent
   */
  const createAgreement = useCallback(async (params: CreateAgreementParams): Promise<Agreement | null> => {
    try {
      setLoading(true);
      setError(null);

      const agreementContent = getAgreementText('Love to Learn Academy');
      const version = params.agreementVersion || AGREEMENT_VERSION;

      const { data, error: rpcError } = await supabase.rpc('create_parent_agreement', {
        p_parent_id: params.parentId,
        p_agreement_content: agreementContent,
        p_agreement_version: version,
        p_agreement_type: params.agreementType || 'tutoring_services',
        p_expires_in_days: params.expiresInDays || 30,
      });

      if (rpcError) {
        console.error('Error creating agreement:', rpcError);
        throw new Error(rpcError.message);
      }

      // Fetch the created agreement
      const createdAgreement = await getAgreementById(data);
      return createdAgreement;
    } catch (err: any) {
      console.error('Error in createAgreement:', err);
      setError(err.message || 'Failed to create agreement');
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAgreementById]);

  /**
   * Sign an agreement with digital signature
   */
  const signAgreement = useCallback(async (params: SignAgreementParams): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const deviceInfo = getDeviceInfo();

      const { data, error: rpcError } = await supabase.rpc('sign_parent_agreement', {
        p_agreement_id: params.agreementId,
        p_signature_data: params.signatureData,
        p_signed_by_name: params.signedByName,
        p_signed_by_email: params.signedByEmail,
        p_ip_address: null, // Can't get IP from client
        p_user_agent: Platform.OS === 'web' ? navigator.userAgent : null,
        p_device_info: deviceInfo,
      });

      if (rpcError) {
        console.error('Error signing agreement:', rpcError);
        throw new Error(rpcError.message);
      }

      if (!data) {
        throw new Error('Agreement could not be signed. It may have expired or already been signed.');
      }

      // Refresh the agreement data
      await getAgreementById(params.agreementId);

      return true;
    } catch (err: any) {
      console.error('Error in signAgreement:', err);
      setError(err.message || 'Failed to sign agreement');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getAgreementById]);

  return {
    loading,
    error,
    agreement,
    checkAgreementStatus,
    getAgreement,
    createAgreement,
    signAgreement,
    getAgreementById,
    clearError,
  };
}

/**
 * Hook for checking if the current user needs to sign an agreement
 */
export function useAgreementCheck() {
  const [needsAgreement, setNeedsAgreement] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [pendingAgreementId, setPendingAgreementId] = useState<string | null>(null);

  const checkCurrentUser = useCallback(async () => {
    try {
      setChecking(true);

      // Get current user's parent record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNeedsAgreement(false);
        return;
      }

      // Get parent record
      const { data: parent } = await supabase
        .from('parents')
        .select('id, role, requires_agreement, agreement_signed_at')
        .eq('user_id', user.id)
        .single();

      if (!parent) {
        setNeedsAgreement(false);
        return;
      }

      // Tutors don't need to sign agreements
      if (parent.role === 'tutor') {
        setNeedsAgreement(false);
        return;
      }

      // Check if parent has signed and doesn't require new agreement
      if (parent.agreement_signed_at && !parent.requires_agreement) {
        setNeedsAgreement(false);
        return;
      }

      // Check for pending agreement
      const { data: pendingAgreement } = await supabase
        .from('parent_agreements')
        .select('id')
        .eq('parent_id', parent.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (pendingAgreement) {
        setPendingAgreementId(pendingAgreement.id);
        setNeedsAgreement(true);
      } else {
        // No pending agreement, may need to create one
        setNeedsAgreement(parent.requires_agreement !== false);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
      setNeedsAgreement(false);
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    needsAgreement,
    checking,
    pendingAgreementId,
    checkCurrentUser,
  };
}

export default useParentAgreement;
