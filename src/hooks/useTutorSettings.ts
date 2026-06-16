/**
 * useTutorSettings.ts
 * Hooks for managing tutor rate settings
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  TutorSettings,
  UpdateTutorSettingsInput,
  SubjectRates,
  SubjectRateConfig,
  QueryState,
  Json,
} from '../types/database';

// Default settings when no record exists
const DEFAULT_SETTINGS: Omit<TutorSettings, 'id' | 'tutor_id' | 'created_at' | 'updated_at'> = {
  default_rate: 45,           // $45 default
  default_base_duration: 60,  // per 60 minutes
  subject_rates: {},
  group_subject_rates: {},
};

/**
 * Hook to fetch tutor settings
 * @returns TutorSettings or defaults if none exist
 */
export function useTutorSettings(): QueryState<TutorSettings> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<TutorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Return defaults for non-authenticated users
        setData({
          id: '',
          tutor_id: '',
          ...DEFAULT_SETTINGS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      // Try to fetch existing settings
      const { data: settings, error: fetchError } = await supabase
        .from('tutor_settings')
        .select('*')
        .eq('tutor_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (settings) {
        // Parse subject_rates from JSON
        setData({
          ...settings,
          subject_rates: (settings.subject_rates as SubjectRates) || {},
          group_subject_rates: (settings.group_subject_rates as SubjectRates) || {},
        });
      } else {
        // Return defaults with user info
        setData({
          id: '',
          tutor_id: user.id,
          ...DEFAULT_SETTINGS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch tutor settings');
      setError(errorMessage);
      console.error('useTutorSettings error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { data, loading, error, refetch: fetchSettings };
}

/**
 * Hook to update tutor settings (upsert)
 * @returns Mutation state with update function
 */
export function useUpdateTutorSettings() {
  const [data, setData] = useState<TutorSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: UpdateTutorSettingsInput): Promise<TutorSettings | null> => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to update settings');
      }

      // Check if settings exist
      const { data: existing } = await supabase
        .from('tutor_settings')
        .select('id')
        .eq('tutor_id', user.id)
        .maybeSingle();

      let result;

      if (existing) {
        // Update existing
        const { data: updated, error: updateError } = await supabase
          .from('tutor_settings')
          .update({
            default_rate: input.default_rate,
            default_base_duration: input.default_base_duration,
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            group_subject_rates: (input.group_subject_rates || {}) as unknown as Json,
          })
          .eq('tutor_id', user.id)
          .select()
          .single();

        if (updateError) throw new Error(updateError.message);
        result = updated;
      } else {
        // Insert new
        const { data: created, error: createError } = await supabase
          .from('tutor_settings')
          .insert({
            tutor_id: user.id,
            default_rate: input.default_rate ?? DEFAULT_SETTINGS.default_rate,
            default_base_duration: input.default_base_duration ?? DEFAULT_SETTINGS.default_base_duration,
            subject_rates: (input.subject_rates || {}) as unknown as Json,
            group_subject_rates: (input.group_subject_rates || {}) as unknown as Json,
          })
          .select()
          .single();

        if (createError) throw new Error(createError.message);
        result = created;
      }

      const settings: TutorSettings = {
        ...result,
        subject_rates: (result.subject_rates as SubjectRates) || {},
        group_subject_rates: (result.group_subject_rates as SubjectRates) || {},
      };

      setData(settings);
      return settings;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update tutor settings');
      setError(errorMessage);
      console.error('useUpdateTutorSettings error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, mutate, reset };
}

/**
 * Get the rate config for a specific subject from tutor settings
 * Falls back to default rate/duration if no subject-specific rate exists
 * @returns { rate: number, base_duration: number }
 */
export function getSubjectRateConfig(
  settings: TutorSettings | null,
  subject: string
): SubjectRateConfig {
  const defaultConfig: SubjectRateConfig = {
    rate: settings?.default_rate ?? DEFAULT_SETTINGS.default_rate,
    base_duration: settings?.default_base_duration ?? DEFAULT_SETTINGS.default_base_duration,
  };

  if (!settings) return defaultConfig;

  const subjectRates = settings.subject_rates;
  if (subjectRates && subject in subjectRates) {
    const rateConfig = subjectRates[subject as keyof SubjectRates];
    if (rateConfig && rateConfig.rate > 0 && rateConfig.base_duration > 0) {
      return rateConfig;
    }
  }

  return defaultConfig;
}

/**
 * Calculate lesson amount based on tutor settings
 * Supports duration-based rates with explicit pricing tiers
 * @param settings Tutor settings
 * @param subject Lesson subject
 * @param durationMin Lesson duration in minutes
 * @param isCombinedSession Whether this is a combined session (flat rate applies)
 */
export function calculateLessonRate(
  settings: TutorSettings | null,
  subject: string,
  durationMin: number,
  isCombinedSession: boolean
): number {
  // Combined sessions prefer the per-subject group rate when set; otherwise fall
  // back to the individual subject rate (then the tutor default).
  let rateConfig: SubjectRateConfig | undefined;
  if (isCombinedSession) {
    const groupRates = settings?.group_subject_rates as
      | Record<string, SubjectRateConfig>
      | null
      | undefined;
    const groupCfg = groupRates?.[subject];
    if (groupCfg && groupCfg.rate > 0 && groupCfg.base_duration > 0) {
      rateConfig = groupCfg;
    }
  }
  if (!rateConfig) {
    rateConfig = getSubjectRateConfig(settings, subject);
  }

  // Check for explicit duration price first (string keys from JSON).
  const durationPricesRaw = rateConfig.duration_prices;
  if (durationPricesRaw && typeof durationPricesRaw === 'object') {
    const durationKey = String(durationMin);
    const explicitPrice = (durationPricesRaw as Record<string, number>)[durationKey];
    if (typeof explicitPrice === 'number' && explicitPrice > 0) {
      return explicitPrice;
    }
  }

  // Fall back to linear calculation: (lesson duration / base duration) * rate
  return (durationMin / rateConfig.base_duration) * rateConfig.rate;
}

/**
 * Format rate for display (e.g., "$35/30min" or "$45/hr")
 */
export function formatRateDisplay(rate: number, baseDuration: number): string {
  if (baseDuration === 60) {
    return `$${rate}/hr`;
  }
  return `$${rate}/${baseDuration}min`;
}
