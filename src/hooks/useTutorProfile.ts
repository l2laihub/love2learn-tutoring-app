/**
 * useTutorProfile.ts
 * Hooks for managing tutor business profile and settings
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import {
  Parent,
  TutorSettings,
  SubjectRates,
  SubjectRateConfig,
  TutoringSubject,
  QueryState,
  Json,
} from '../types/database';

// Logo storage bucket name (using same bucket as avatars)
const LOGOS_BUCKET = 'avatars';
const LOGO_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

// Common timezone options
export const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
] as const;

// Default subjects with their colors
export const DEFAULT_SUBJECTS: {
  key: TutoringSubject;
  label: string;
  emoji: string;
  color: string;
  defaultDuration: number;
}[] = [
  { key: 'piano', label: 'Piano', emoji: '🎹', color: '#3D9CA8', defaultDuration: 30 },
  { key: 'math', label: 'Math', emoji: '➗', color: '#7CB342', defaultDuration: 60 },
  { key: 'reading', label: 'Reading', emoji: '📚', color: '#9C27B0', defaultDuration: 60 },
  { key: 'speech', label: 'Speech', emoji: '🗣️', color: '#FF9800', defaultDuration: 60 },
  { key: 'english', label: 'English', emoji: '📝', color: '#2196F3', defaultDuration: 60 },
];

// Color palette for custom subjects
export const SUBJECT_COLOR_PALETTE = [
  '#3D9CA8', // Teal
  '#7CB342', // Green
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#FF6B6B', // Coral
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#FFC107', // Amber
  '#4CAF50', // Green
] as const;

// Custom subject type
export interface CustomSubject {
  id: string;
  name: string;
  color: string;
  rate?: number;
  baseDuration?: number;
  createdAt: string;
}

// Tutor profile combining parent info and settings
export interface TutorProfile {
  // From parents table
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  logoUrl: string | null; // Business logo stored in avatar_url or separate field
  timezone: string;

  // From tutor_settings table
  defaultRate: number;
  defaultBaseDuration: number;
  combinedSessionRate: number;
  subjectRates: SubjectRates;
  customSubjects: CustomSubject[];
}

// Input type for updating business info
export interface UpdateBusinessInfoInput {
  name?: string;
  email?: string;
  phone?: string | null;
  timezone?: string;
}

// Input type for custom subject
export interface CustomSubjectInput {
  name: string;
  color: string;
  rate?: number;
  baseDuration?: number;
}

// Default tutor profile
const DEFAULT_PROFILE: Omit<TutorProfile, 'id' | 'userId' | 'name' | 'email'> = {
  phone: null,
  avatarUrl: null,
  logoUrl: null,
  timezone: 'America/New_York',
  defaultRate: 45,
  defaultBaseDuration: 60,
  combinedSessionRate: 40,
  subjectRates: {},
  customSubjects: [],
};

/**
 * Hook to fetch tutor profile (combines parent and tutor_settings data)
 */
export function useTutorProfile(): QueryState<TutorProfile> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      // Fetch tutor's parent record
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'tutor')
        .maybeSingle();

      if (parentError) {
        throw new Error(parentError.message);
      }

      if (!parent) {
        // No tutor profile found
        setData(null);
        setLoading(false);
        return;
      }

      // Fetch tutor settings
      const { data: settings, error: settingsError } = await supabase
        .from('tutor_settings')
        .select('*')
        .eq('tutor_id', user.id)
        .maybeSingle();

      if (settingsError) {
        console.warn('Could not fetch tutor settings:', settingsError);
      }

      // Parse custom subjects from settings
      const customSubjects: CustomSubject[] = [];
      const subjectRates = (settings?.subject_rates as SubjectRates) || {};

      // Extract timezone from parent preferences or use default
      const preferences = parent.preferences as { timezone?: string } | null;
      const timezone = preferences?.timezone || DEFAULT_PROFILE.timezone;

      // Build profile
      const profile: TutorProfile = {
        id: parent.id,
        userId: parent.user_id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
        avatarUrl: parent.avatar_url,
        logoUrl: parent.avatar_url, // Using avatar_url for logo for now
        timezone,
        defaultRate: settings?.default_rate ?? DEFAULT_PROFILE.defaultRate,
        defaultBaseDuration: settings?.default_base_duration ?? DEFAULT_PROFILE.defaultBaseDuration,
        combinedSessionRate: settings?.combined_session_rate ?? DEFAULT_PROFILE.combinedSessionRate,
        subjectRates,
        customSubjects,
      };

      setData(profile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch tutor profile');
      setError(errorMessage);
      console.error('useTutorProfile error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { data, loading, error, refetch: fetchProfile };
}

/**
 * Hook to update tutor business information
 */
export function useUpdateBusinessInfo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: UpdateBusinessInfoInput): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to update business info');
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;

      // Handle timezone - stored in preferences JSONB
      if (input.timezone !== undefined) {
        // First, fetch current preferences
        const { data: current } = await supabase
          .from('parents')
          .select('preferences')
          .eq('user_id', user.id)
          .single();

        const currentPrefs = (current?.preferences || {}) as Record<string, unknown>;
        updateData.preferences = {
          ...currentPrefs,
          timezone: input.timezone,
        };
      }

      // Update parent record
      const { error: updateError } = await supabase
        .from('parents')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update business info');
      setError(errorMessage);
      console.error('useUpdateBusinessInfo error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, mutate };
}

/**
 * Hook to upload/delete business logo
 */
export function useLogoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadLogo = useCallback(async (
    entityId: string,
    onSuccess?: (url: string) => void
  ): Promise<string | null> => {
    try {
      setUploading(true);
      setError(null);

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Photo library permission is required');
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return null;
      }

      const image = result.assets[0];
      const uri = image.uri;
      const mimeType = image.mimeType || 'image/jpeg';
      const timestamp = Date.now();
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `logo_${timestamp}.${extension}`;
      const filePath = `logos/${entityId}/${fileName}`;

      let fileData: Blob | Uint8Array;

      // Handle different platforms
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        if (blob.size > LOGO_SIZE_LIMIT) {
          throw new Error('Image is too large. Maximum size is 5MB.');
        }
        fileData = blob;
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        if (bytes.length > LOGO_SIZE_LIMIT) {
          throw new Error('Image is too large. Maximum size is 5MB.');
        }
        fileData = bytes;
      }

      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from(LOGOS_BUCKET)
        .upload(filePath, fileData, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(LOGOS_BUCKET)
        .getPublicUrl(data.path);

      const publicUrl = urlData.publicUrl;
      onSuccess?.(publicUrl);
      return publicUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to upload logo');
      setError(errorMessage);
      console.error('useLogoUpload error:', errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const deleteLogo = useCallback(async (logoUrl: string): Promise<boolean> => {
    try {
      setUploading(true);
      setError(null);

      // Extract path from URL
      const match = logoUrl.match(/\/avatars\/(.+)$/);
      if (match) {
        await supabase.storage.from(LOGOS_BUCKET).remove([match[1]]);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete logo');
      setError(errorMessage);
      console.error('deleteLogo error:', errorMessage);
      return false;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploading, error, uploadLogo, deleteLogo };
}

/**
 * Hook to update subject rates (combines with existing useTutorSettings)
 */
export function useUpdateSubjectRates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateSubjectRate = useCallback(async (
    subject: string,
    rate: number,
    baseDuration: number = 60
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Get current settings
      const { data: current } = await supabase
        .from('tutor_settings')
        .select('subject_rates')
        .eq('tutor_id', user.id)
        .maybeSingle();

      const currentRates = (current?.subject_rates || {}) as SubjectRates;
      const newRates = {
        ...currentRates,
        [subject]: { rate, base_duration: baseDuration } as SubjectRateConfig,
      };

      // Upsert settings
      const { error: upsertError } = await supabase
        .from('tutor_settings')
        .upsert({
          tutor_id: user.id,
          subject_rates: newRates as unknown as Json,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tutor_id',
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update subject rate');
      setError(errorMessage);
      console.error('useUpdateSubjectRates error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeSubjectRate = useCallback(async (subject: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Get current settings
      const { data: current } = await supabase
        .from('tutor_settings')
        .select('subject_rates')
        .eq('tutor_id', user.id)
        .maybeSingle();

      if (!current) return true;

      const currentRates = (current.subject_rates || {}) as SubjectRates;
      const newRates = { ...currentRates };
      delete newRates[subject as keyof SubjectRates];

      // Update settings
      const { error: updateError } = await supabase
        .from('tutor_settings')
        .update({
          subject_rates: newRates as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('tutor_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to remove subject rate');
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, updateSubjectRate, removeSubjectRate };
}

/**
 * Hook for managing custom subjects
 * Note: Custom subjects are stored in tutor_settings.subject_rates with non-standard keys
 */
export function useCustomSubjects() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createCustomSubject = useCallback(async (input: CustomSubjectInput): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Generate a key for the custom subject
      const subjectKey = `custom_${input.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

      // Get current settings
      const { data: current } = await supabase
        .from('tutor_settings')
        .select('subject_rates')
        .eq('tutor_id', user.id)
        .maybeSingle();

      const currentRates = (current?.subject_rates || {}) as Record<string, unknown>;
      const newRates = {
        ...currentRates,
        [subjectKey]: {
          rate: input.rate || 45,
          base_duration: input.baseDuration || 60,
          // Store extra metadata for custom subjects
          _custom: true,
          _name: input.name,
          _color: input.color,
          _createdAt: new Date().toISOString(),
        },
      };

      // Upsert settings
      const { error: upsertError } = await supabase
        .from('tutor_settings')
        .upsert({
          tutor_id: user.id,
          subject_rates: newRates as unknown as Json,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tutor_id',
        });

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create custom subject');
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCustomSubject = useCallback(async (
    subjectKey: string,
    input: CustomSubjectInput
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Get current settings
      const { data: current } = await supabase
        .from('tutor_settings')
        .select('subject_rates')
        .eq('tutor_id', user.id)
        .maybeSingle();

      if (!current) {
        throw new Error('Settings not found');
      }

      const currentRates = (current.subject_rates || {}) as Record<string, unknown>;
      const existingSubject = currentRates[subjectKey] as Record<string, unknown> | undefined;

      const newRates = {
        ...currentRates,
        [subjectKey]: {
          rate: input.rate || 45,
          base_duration: input.baseDuration || 60,
          _custom: true,
          _name: input.name,
          _color: input.color,
          _createdAt: (existingSubject?._createdAt as string) || new Date().toISOString(),
        },
      };

      const { error: updateError } = await supabase
        .from('tutor_settings')
        .update({
          subject_rates: newRates as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('tutor_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update custom subject');
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCustomSubject = useCallback(async (subjectKey: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      // Get current settings
      const { data: current } = await supabase
        .from('tutor_settings')
        .select('subject_rates')
        .eq('tutor_id', user.id)
        .maybeSingle();

      if (!current) return true;

      const currentRates = (current.subject_rates || {}) as Record<string, unknown>;
      const newRates = { ...currentRates };
      delete newRates[subjectKey];

      const { error: updateError } = await supabase
        .from('tutor_settings')
        .update({
          subject_rates: newRates as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('tutor_id', user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete custom subject');
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, createCustomSubject, updateCustomSubject, deleteCustomSubject };
}

/**
 * Helper to extract custom subjects from subject_rates
 */
export function extractCustomSubjects(subjectRates: Record<string, unknown>): CustomSubject[] {
  const customSubjects: CustomSubject[] = [];

  for (const [key, value] of Object.entries(subjectRates)) {
    if (key.startsWith('custom_') && typeof value === 'object' && value !== null) {
      const subject = value as Record<string, unknown>;
      if (subject._custom) {
        customSubjects.push({
          id: key,
          name: (subject._name as string) || key,
          color: (subject._color as string) || '#3D9CA8',
          rate: (subject.rate as number) || undefined,
          baseDuration: (subject.base_duration as number) || undefined,
          createdAt: (subject._createdAt as string) || new Date().toISOString(),
        });
      }
    }
  }

  return customSubjects.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}
