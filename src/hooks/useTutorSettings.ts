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
  combined_session_rate: 40,
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
            combined_session_rate: input.combined_session_rate,
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
            combined_session_rate: input.combined_session_rate ?? DEFAULT_SETTINGS.combined_session_rate,
          })
          .select()
          .single();

        if (createError) throw new Error(createError.message);
        result = created;
      }

      const settings: TutorSettings = {
        ...result,
        subject_rates: (result.subject_rates as SubjectRates) || {},
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
  if (isCombinedSession) {
    // Flat rate per student for combined sessions
    return settings?.combined_session_rate ?? DEFAULT_SETTINGS.combined_session_rate;
  }

  // Get the rate config for this subject
  const rateConfig = getSubjectRateConfig(settings, subject);

  // Check for explicit duration price first
  // JSON from database has string keys, so we must use string key for lookup
  const durationPricesRaw = rateConfig.duration_prices;
  if (durationPricesRaw && typeof durationPricesRaw === 'object') {
    const durationKey = String(durationMin);
    const explicitPrice = (durationPricesRaw as Record<string, number>)[durationKey];
    if (typeof explicitPrice === 'number' && explicitPrice > 0) {
      return explicitPrice;
    }
  }

  // Fall back to linear calculation: (lesson duration / base duration) * rate
  // e.g., 30min lesson with $35/30min rate = (30/30) * 35 = $35
  // e.g., 60min lesson with $35/30min rate = (60/30) * 35 = $70
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
