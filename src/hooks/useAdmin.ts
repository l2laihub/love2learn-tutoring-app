/**
 * useAdmin Hook
 * Manages admin panel operations including dashboard stats,
 * parent management, and agreement template management
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface DashboardStats {
  totalParents: number;
  activeParents: number;
  pendingAgreements: number;
  signedAgreements: number;
  totalStudents: number;
  pendingInvitations: number;
}

export interface AgreementWithParent {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  agreementVersion: string;
  agreementType: string;
  status: 'pending' | 'signed' | 'expired' | 'revoked';
  signatureData: string | null;
  signatureTimestamp: string | null;
  signedByName: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface AgreementTemplate {
  id: string;
  name: string;
  version: string;
  agreementType: string;
  content: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ParentWithAgreementStatus {
  id: string;
  name: string;
  email: string;
  userId: string | null;
  role: string;
  onboardingCompletedAt: string | null;
  requiresAgreement: boolean | null;
  agreementSignedAt: string | null;
  invitationSentAt: string | null;
  invitationExpiresAt: string | null;
  invitationAcceptedAt: string | null;
  studentCount: number;
}

// ============================================================================
// Dashboard Stats Hook
// ============================================================================

export function useAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_admin_dashboard_stats');

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (data && data.length > 0) {
        const row = data[0];
        setStats({
          totalParents: Number(row.total_parents) || 0,
          activeParents: Number(row.active_parents) || 0,
          pendingAgreements: Number(row.pending_agreements) || 0,
          signedAgreements: Number(row.signed_agreements) || 0,
          totalStudents: Number(row.total_students) || 0,
          pendingInvitations: Number(row.pending_invitations) || 0,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard stats';
      console.error('Error fetching dashboard stats:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// ============================================================================
// Agreements Management Hook
// ============================================================================

export function useAdminAgreements() {
  const [agreements, setAgreements] = useState<AgreementWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgreements = useCallback(async (statusFilter?: string) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('parent_agreements')
        .select(`
          id,
          parent_id,
          agreement_version,
          agreement_type,
          status,
          signature_data,
          signature_timestamp,
          signed_by_name,
          created_at,
          expires_at,
          parents!parent_id(
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      const formattedAgreements: AgreementWithParent[] = (data || []).map((item: Record<string, unknown>) => {
        const parent = item.parents as Record<string, unknown> | null;
        return {
          id: item.id as string,
          parentId: item.parent_id as string,
          parentName: parent?.name as string || 'Unknown',
          parentEmail: parent?.email as string || '',
          agreementVersion: item.agreement_version as string,
          agreementType: item.agreement_type as string,
          status: item.status as 'pending' | 'signed' | 'expired' | 'revoked',
          signatureData: item.signature_data as string | null,
          signatureTimestamp: item.signature_timestamp as string | null,
          signedByName: item.signed_by_name as string | null,
          createdAt: item.created_at as string,
          expiresAt: item.expires_at as string | null,
        };
      });

      setAgreements(formattedAgreements);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch agreements';
      console.error('Error fetching agreements:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  return { agreements, loading, error, refetch: fetchAgreements };
}

// ============================================================================
// Parent Management Hook
// ============================================================================

export function useAdminParents() {
  const [parents, setParents] = useState<ParentWithAgreementStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('parents')
        .select(`
          id,
          name,
          email,
          user_id,
          role,
          onboarding_completed_at,
          requires_agreement,
          agreement_signed_at,
          invitation_sent_at,
          invitation_expires_at,
          invitation_accepted_at,
          students!parent_id(id)
        `)
        .eq('role', 'parent')
        .order('name');

      if (queryError) {
        throw new Error(queryError.message);
      }

      const formattedParents: ParentWithAgreementStatus[] = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: item.name as string,
        email: item.email as string,
        userId: item.user_id as string | null,
        role: item.role as string,
        onboardingCompletedAt: item.onboarding_completed_at as string | null,
        requiresAgreement: item.requires_agreement as boolean | null,
        agreementSignedAt: item.agreement_signed_at as string | null,
        invitationSentAt: item.invitation_sent_at as string | null,
        invitationExpiresAt: item.invitation_expires_at as string | null,
        invitationAcceptedAt: item.invitation_accepted_at as string | null,
        studentCount: ((item.students as unknown[]) || []).length,
      }));

      setParents(formattedParents);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch parents';
      console.error('Error fetching parents:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetOnboarding = useCallback(async (parentId: string, revokeAgreements: boolean = true): Promise<boolean> => {
    try {
      setActionLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: rpcError } = await supabase.rpc('reset_parent_onboarding', {
        p_parent_id: parentId,
        p_admin_user_id: user?.id || null,
        p_revoke_agreements: revokeAgreements,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Refresh parents list
      await fetchParents();

      return data === true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset onboarding';
      console.error('Error resetting onboarding:', err);
      setError(errorMessage);
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [fetchParents]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  return { parents, loading, error, actionLoading, refetch: fetchParents, resetOnboarding };
}

// ============================================================================
// Agreement Templates Hook
// ============================================================================

export function useAgreementTemplates() {
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('agreement_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) {
        throw new Error(queryError.message);
      }

      const formattedTemplates: AgreementTemplate[] = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: item.name as string,
        version: item.version as string,
        agreementType: item.agreement_type as string,
        content: item.content as string,
        isActive: item.is_active as boolean,
        isDefault: item.is_default as boolean,
        createdAt: item.created_at as string,
        updatedAt: item.updated_at as string,
        publishedAt: item.published_at as string | null,
      }));

      setTemplates(formattedTemplates);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      console.error('Error fetching templates:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveTemplate = useCallback(async (
    template: {
      name: string;
      version: string;
      content: string;
      agreementType?: string;
      setActive?: boolean;
      setDefault?: boolean;
    },
    templateId?: string
  ): Promise<string | null> => {
    try {
      setSaving(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: rpcError } = await supabase.rpc('save_agreement_template', {
        p_name: template.name,
        p_version: template.version,
        p_content: template.content,
        p_agreement_type: template.agreementType || 'tutoring_services',
        p_set_active: template.setActive || false,
        p_set_default: template.setDefault || false,
        p_admin_user_id: user?.id || null,
        p_template_id: templateId || null,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Refresh templates list
      await fetchTemplates();

      return data as string;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      console.error('Error saving template:', err);
      setError(errorMessage);
      return null;
    } finally {
      setSaving(false);
    }
  }, [fetchTemplates]);

  const getActiveTemplate = useCallback(async (agreementType: string = 'tutoring_services'): Promise<AgreementTemplate | null> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_active_agreement_template', {
        p_agreement_type: agreementType,
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (data && data.length > 0) {
        const row = data[0];
        return {
          id: row.template_id,
          name: row.template_name,
          version: row.template_version,
          content: row.template_content,
          agreementType,
          isActive: true,
          isDefault: true,
          createdAt: '',
          updatedAt: '',
          publishedAt: null,
        };
      }

      return null;
    } catch (err: unknown) {
      console.error('Error getting active template:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, loading, error, saving, refetch: fetchTemplates, saveTemplate, getActiveTemplate };
}

// ============================================================================
// Audit Log Hook
// ============================================================================

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (limit: number = 50) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw new Error(queryError.message);
      }

      const formattedEntries: AuditLogEntry[] = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        adminUserId: item.admin_user_id as string,
        action: item.action as string,
        entityType: item.entity_type as string,
        entityId: item.entity_id as string | null,
        details: item.details as Record<string, unknown> | null,
        createdAt: item.created_at as string,
      }));

      setEntries(formattedEntries);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit log';
      console.error('Error fetching audit log:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, error, refetch: fetchEntries };
}

export default {
  useAdminDashboard,
  useAdminAgreements,
  useAdminParents,
  useAgreementTemplates,
  useAuditLog,
};
