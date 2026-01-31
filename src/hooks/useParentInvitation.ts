/**
 * useParentInvitation Hook
 * Handles sending and managing parent invitation emails
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface InvitationStatus {
  hasSentInvitation: boolean;
  invitationSentAt: string | null;
  invitationExpiresAt: string | null;
  isExpired: boolean;
  hasAccount: boolean;
}

export interface SendInvitationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Hook for sending parent invitations
 */
export function useSendParentInvitation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendInvitation = useCallback(async (parentId: string): Promise<SendInvitationResult> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke('send-parent-invite', {
        body: { parentId },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        success: true,
        message: data.message || 'Invitation sent successfully',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(new Error(errorMessage));
      return {
        success: false,
        message: 'Failed to send invitation',
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendInvitation, loading, error };
}

/**
 * Hook for getting invitation status of a parent
 */
export function useParentInvitationStatus(parentId: string | null) {
  const [status, setStatus] = useState<InvitationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!parentId) {
      setStatus(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('parents')
        .select('user_id, invitation_sent_at, invitation_expires_at, invitation_accepted_at')
        .eq('id', parentId)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const now = new Date();
      const expiresAt = data.invitation_expires_at ? new Date(data.invitation_expires_at) : null;

      setStatus({
        hasSentInvitation: !!data.invitation_sent_at,
        invitationSentAt: data.invitation_sent_at,
        invitationExpiresAt: data.invitation_expires_at,
        isExpired: expiresAt ? expiresAt < now : false,
        hasAccount: !!data.user_id,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch invitation status');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  return { status, loading, error, refetch: fetchStatus };
}

/**
 * Invitation validation result with tutor info
 */
export interface InvitationValidationResult {
  isValid: boolean;
  parentId?: string;
  email?: string;
  name?: string;
  tutorId?: string;
  tutorBusinessName?: string;
  tutorName?: string;
  tutorSubscriptionActive?: boolean;
  error?: string;
}

/**
 * Validate an invitation token (for registration page)
 * Returns tutor information for multi-tenant branding
 */
export async function validateInvitationToken(token: string): Promise<InvitationValidationResult> {
  try {
    const { data, error } = await supabase
      .rpc('validate_invitation_token', { token });

    if (error) {
      return { isValid: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { isValid: false, error: 'Invalid invitation token' };
    }

    const result = data[0];

    if (!result.is_valid) {
      return { isValid: false, error: result.error_message || 'Invalid invitation' };
    }

    return {
      isValid: true,
      parentId: result.parent_id,
      email: result.email,
      name: result.name,
      tutorId: result.tutor_id,
      tutorBusinessName: result.tutor_business_name,
      tutorName: result.tutor_name,
      tutorSubscriptionActive: result.tutor_subscription_active,
    };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Failed to validate token',
    };
  }
}

/**
 * Hook for getting tutor info for the current parent user
 */
export function useTutorInfo() {
  const [tutorInfo, setTutorInfo] = useState<{
    tutorId: string | null;
    tutorName: string | null;
    businessName: string | null;
    subscriptionActive: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTutorInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_my_tutor_info');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (data && data.length > 0) {
        const result = data[0];
        setTutorInfo({
          tutorId: result.tutor_id,
          tutorName: result.tutor_name,
          businessName: result.business_name,
          subscriptionActive: result.subscription_active,
        });
      } else {
        setTutorInfo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tutor info'));
    } finally {
      setLoading(false);
    }
  }, []);

  return { tutorInfo, loading, error, refetch: fetchTutorInfo };
}

/**
 * Get formatted invitation status text
 */
export function getInvitationStatusText(status: InvitationStatus | null): {
  text: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'muted';
} {
  if (!status) {
    return { text: 'Loading...', color: 'muted' };
  }

  if (status.hasAccount) {
    return { text: 'Account Active', color: 'success' };
  }

  if (status.hasSentInvitation) {
    if (status.isExpired) {
      return { text: 'Invitation Expired', color: 'error' };
    }

    // Calculate days remaining
    if (status.invitationExpiresAt) {
      const expiresAt = new Date(status.invitationExpiresAt);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 1) {
        return { text: 'Expires today', color: 'warning' };
      }

      return { text: `Invited (${daysRemaining}d left)`, color: 'info' };
    }

    return { text: 'Invitation Sent', color: 'info' };
  }

  return { text: 'Not Invited', color: 'muted' };
}

/**
 * Format relative time for invitation sent date
 */
export function formatInvitationSentTime(sentAt: string | null): string {
  if (!sentAt) return 'Never';

  const sent = new Date(sentAt);
  const now = new Date();
  const diffMs = now.getTime() - sent.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return sent.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
