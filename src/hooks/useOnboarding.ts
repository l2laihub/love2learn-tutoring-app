/**
 * useOnboarding Hook
 * Manages parent onboarding state and completion
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { ParentPreferences } from '../types/database';

interface OnboardingData {
  name: string;
  phone: string | null;
  preferences: ParentPreferences;
}

interface UseOnboardingReturn {
  /** Whether the current parent needs onboarding */
  needsOnboarding: boolean;
  /** Loading state for async operations */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Complete the onboarding process */
  completeOnboarding: (data: OnboardingData) => Promise<boolean>;
  /** Check if onboarding is needed */
  checkOnboardingStatus: () => Promise<boolean>;
}

export function useOnboarding(): UseOnboardingReturn {
  const { parent, isParent, refreshParent } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if parent needs onboarding
  const needsOnboarding = Boolean(
    isParent &&
    parent &&
    !parent.onboarding_completed_at
  );

  /**
   * Check onboarding status from database
   */
  const checkOnboardingStatus = useCallback(async (): Promise<boolean> => {
    if (!parent?.id) return false;

    try {
      const { data, error: queryError } = await supabase
        .from('parents')
        .select('onboarding_completed_at')
        .eq('id', parent.id)
        .single();

      if (queryError) {
        console.error('[useOnboarding] Error checking status:', queryError);
        return false;
      }

      return !data?.onboarding_completed_at;
    } catch (err) {
      console.error('[useOnboarding] Unexpected error:', err);
      return false;
    }
  }, [parent?.id]);

  /**
   * Complete the onboarding process
   */
  const completeOnboarding = useCallback(async (data: OnboardingData): Promise<boolean> => {
    if (!parent?.id) {
      setError('No parent record found');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('parents')
        .update({
          name: data.name,
          phone: data.phone,
          preferences: data.preferences,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parent.id);

      if (updateError) {
        console.error('[useOnboarding] Error completing onboarding:', updateError);
        setError(updateError.message);
        return false;
      }

      console.log('[useOnboarding] Onboarding completed successfully');

      // Refresh parent data in context so navigation guards see the updated state
      await refreshParent();

      return true;
    } catch (err) {
      console.error('[useOnboarding] Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [parent?.id]);

  return {
    needsOnboarding,
    loading,
    error,
    completeOnboarding,
    checkOnboardingStatus,
  };
}

/**
 * Default preferences for new parents
 */
export const DEFAULT_PARENT_PREFERENCES: ParentPreferences = {
  notifications: {
    lesson_reminders: true,
    lesson_reminders_hours_before: 24,
    worksheet_assigned: true,
    payment_due: true,
    lesson_notes: true,
  },
  contact_preference: 'email',
};
