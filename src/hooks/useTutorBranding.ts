/**
 * useTutorBranding Hook
 *
 * Provides tutor-specific branding and settings for configurable app personalization.
 * This hook fetches and caches tutor branding data including:
 * - Business name
 * - Logo URL
 * - Timezone
 * - Custom subjects and colors
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { colors, Subject as ThemeSubject } from '../theme';
import { QueryState, Json } from '../types/database';

// ============================================================================
// Types
// ============================================================================

/**
 * Custom subject definition from tutor_settings
 */
export interface CustomSubject {
  id: string;
  name: string;
  color: string;
}

/**
 * Subject color palette (matches theme subject color structure)
 */
export interface SubjectColorPalette {
  primary: string;
  light: string;
  dark: string;
  subtle: string;
  gradient: readonly [string, string];
}

/**
 * Combined subject type (default + custom)
 */
export interface SubjectConfig {
  key: string; // 'piano', 'math', or custom ID
  name: string;
  isCustom: boolean;
  color: SubjectColorPalette;
}

/**
 * Tutor branding data
 */
export interface TutorBranding {
  businessName: string | null;
  logoUrl: string | null;
  timezone: string;
  customSubjects: CustomSubject[];
}

/**
 * Default timezone for new tutors
 */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Default business name when none is set
 */
export const DEFAULT_BUSINESS_NAME = 'Tutoring Services';

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Generate a lighter shade of a hex color
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a darker shade of a hex color
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a subtle/pastel shade of a hex color
 */
function subtleColor(hex: string): string {
  // Mix the color with white to create a pastel shade
  const num = parseInt(hex.replace('#', ''), 16);
  const R = Math.round(((num >> 16) + 255 * 4) / 5);
  const G = Math.round((((num >> 8) & 0x00ff) + 255 * 4) / 5);
  const B = Math.round(((num & 0x0000ff) + 255 * 4) / 5);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Generate a full color palette from a base color
 */
export function generateColorPalette(baseColor: string): SubjectColorPalette {
  return {
    primary: baseColor,
    light: lightenColor(baseColor, 30),
    dark: darkenColor(baseColor, 15),
    subtle: subtleColor(baseColor),
    gradient: [baseColor, lightenColor(baseColor, 30)] as const,
  };
}

// ============================================================================
// Default Subject Colors (from theme)
// ============================================================================

const DEFAULT_SUBJECT_COLORS: Record<ThemeSubject, SubjectColorPalette> = {
  piano: colors.piano,
  math: colors.math,
  reading: colors.subjects.reading,
  speech: colors.subjects.speech,
  english: colors.subjects.english,
};

const DEFAULT_SUBJECT_NAMES: Record<ThemeSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to fetch and manage tutor branding settings.
 *
 * Works for both:
 * - Tutors viewing their own settings
 * - Parents viewing their tutor's settings (via tutor_id relationship)
 *
 * @param tutorId - Optional tutor ID for parents fetching their tutor's branding.
 *                  If not provided, fetches the current tutor's settings.
 * @returns Tutor branding data, loading state, error, and helper functions
 */
export function useTutorBranding(tutorId?: string): QueryState<TutorBranding> & {
  refetch: () => Promise<void>;
  getSubjectColor: (subject: string) => SubjectColorPalette;
  getAllSubjects: () => SubjectConfig[];
  getSubjectName: (subject: string) => string;
} {
  const { isTutor, user } = useAuthContext();
  const [data, setData] = useState<TutorBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let targetTutorId = tutorId;

      // If no tutorId provided and user is a tutor, use their own ID
      if (!targetTutorId && isTutor && user) {
        targetTutorId = user.id;
      }

      // If still no tutorId, we need to find the tutor (for parents)
      if (!targetTutorId) {
        // Fetch the tutor (single-tutor model - get the first tutor)
        const { data: tutor, error: tutorError } = await supabase
          .from('parents')
          .select('id, user_id, business_name, timezone')
          .eq('role', 'tutor')
          .limit(1)
          .maybeSingle();

        if (tutorError) {
          throw new Error(tutorError.message);
        }

        if (tutor) {
          targetTutorId = tutor.user_id || undefined;

          // Get custom subjects from tutor_settings
          const customSubjects = await fetchCustomSubjects(tutor.user_id);

          setData({
            businessName: tutor.business_name,
            logoUrl: null, // TODO: Add logo_url column when needed
            timezone: tutor.timezone || DEFAULT_TIMEZONE,
            customSubjects,
          });
          return;
        } else {
          // No tutor found - use defaults
          setData({
            businessName: null,
            logoUrl: null,
            timezone: DEFAULT_TIMEZONE,
            customSubjects: [],
          });
          return;
        }
      }

      // Fetch tutor profile data
      const { data: tutor, error: tutorError } = await supabase
        .from('parents')
        .select('id, user_id, business_name, timezone')
        .eq('user_id', targetTutorId)
        .maybeSingle();

      if (tutorError) {
        throw new Error(tutorError.message);
      }

      // Fetch custom subjects from tutor_settings
      const customSubjects = await fetchCustomSubjects(targetTutorId);

      setData({
        businessName: tutor?.business_name || null,
        logoUrl: null, // TODO: Add logo_url column when needed
        timezone: tutor?.timezone || DEFAULT_TIMEZONE,
        customSubjects,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch tutor branding');
      setError(errorMessage);
      console.error('useTutorBranding error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tutorId, isTutor, user]);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  /**
   * Get the color palette for a subject (checks custom subjects first, then defaults)
   */
  const getSubjectColor = useCallback((subject: string): SubjectColorPalette => {
    // Check if it's a custom subject by ID
    const customSubject = data?.customSubjects.find(s => s.id === subject);
    if (customSubject) {
      return generateColorPalette(customSubject.color);
    }

    // Check if it's a custom subject by name (case-insensitive)
    const customByName = data?.customSubjects.find(
      s => s.name.toLowerCase() === subject.toLowerCase()
    );
    if (customByName) {
      return generateColorPalette(customByName.color);
    }

    // Check if it's a default subject
    const defaultSubject = subject.toLowerCase() as ThemeSubject;
    if (defaultSubject in DEFAULT_SUBJECT_COLORS) {
      return DEFAULT_SUBJECT_COLORS[defaultSubject];
    }

    // Fallback to primary theme color
    return colors.primary;
  }, [data?.customSubjects]);

  /**
   * Get the display name for a subject
   */
  const getSubjectName = useCallback((subject: string): string => {
    // Check if it's a custom subject by ID
    const customSubject = data?.customSubjects.find(s => s.id === subject);
    if (customSubject) {
      return customSubject.name;
    }

    // Check if it's a default subject
    const defaultSubject = subject.toLowerCase() as ThemeSubject;
    if (defaultSubject in DEFAULT_SUBJECT_NAMES) {
      return DEFAULT_SUBJECT_NAMES[defaultSubject];
    }

    // Return the subject string as-is (capitalize first letter)
    return subject.charAt(0).toUpperCase() + subject.slice(1);
  }, [data?.customSubjects]);

  /**
   * Get all available subjects (default + custom)
   */
  const getAllSubjects = useCallback((): SubjectConfig[] => {
    const subjects: SubjectConfig[] = [];

    // Add default subjects
    (Object.keys(DEFAULT_SUBJECT_COLORS) as ThemeSubject[]).forEach(key => {
      subjects.push({
        key,
        name: DEFAULT_SUBJECT_NAMES[key],
        isCustom: false,
        color: DEFAULT_SUBJECT_COLORS[key],
      });
    });

    // Add custom subjects
    data?.customSubjects.forEach(custom => {
      subjects.push({
        key: custom.id,
        name: custom.name,
        isCustom: true,
        color: generateColorPalette(custom.color),
      });
    });

    return subjects;
  }, [data?.customSubjects]);

  return {
    data,
    loading,
    error,
    refetch: fetchBranding,
    getSubjectColor,
    getSubjectName,
    getAllSubjects,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch custom subjects from tutor_settings table
 */
async function fetchCustomSubjects(tutorUserId: string | null | undefined): Promise<CustomSubject[]> {
  if (!tutorUserId) return [];

  try {
    const { data: settings, error } = await supabase
      .from('tutor_settings')
      .select('custom_subjects')
      .eq('tutor_id', tutorUserId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching custom subjects:', error.message);
      return [];
    }

    if (!settings?.custom_subjects) {
      return [];
    }

    // Parse the JSONB array
    const customSubjects = settings.custom_subjects as unknown as CustomSubject[];

    // Validate the structure
    if (!Array.isArray(customSubjects)) {
      return [];
    }

    return customSubjects.filter(
      s => s && typeof s.id === 'string' && typeof s.name === 'string'
    );
  } catch (err) {
    console.error('Error parsing custom subjects:', err);
    return [];
  }
}

/**
 * Standalone helper to get subject color with custom subjects support.
 * For use outside of React components or when you have the custom subjects data already.
 *
 * @param subject - Subject key or ID
 * @param customSubjects - Optional array of custom subjects to check
 * @returns Color palette for the subject
 */
export function getSubjectColorWithCustom(
  subject: string,
  customSubjects?: CustomSubject[]
): SubjectColorPalette {
  // Check custom subjects first
  if (customSubjects) {
    const customSubject = customSubjects.find(
      s => s.id === subject || s.name.toLowerCase() === subject.toLowerCase()
    );
    if (customSubject) {
      return generateColorPalette(customSubject.color);
    }
  }

  // Check default subjects
  const defaultSubject = subject.toLowerCase() as ThemeSubject;
  if (defaultSubject in DEFAULT_SUBJECT_COLORS) {
    return DEFAULT_SUBJECT_COLORS[defaultSubject];
  }

  // Fallback
  return colors.primary;
}

// ============================================================================
// Timezone Utilities
// ============================================================================

/**
 * Format a date in the specified timezone
 * @param date - Date to format
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options,
  }).format(d);
}

/**
 * Get the date key (YYYY-MM-DD) for a date in the specified timezone
 * @param isoString - ISO date string
 * @param timezone - IANA timezone string
 * @returns Date key in YYYY-MM-DD format
 */
export function getDateKeyInTimezone(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Get the time string (HH:MM AM/PM) for a date in the specified timezone
 * @param isoString - ISO date string
 * @param timezone - IANA timezone string
 * @returns Time string in HH:MM AM/PM format
 */
export function getTimeInTimezone(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
