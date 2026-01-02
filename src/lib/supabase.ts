/**
 * Supabase Client Configuration
 * Love2Learn Tutoring App
 *
 * Initializes the Supabase client with Expo secure storage for auth persistence
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Database } from '../types/database';

// Environment variables with development fallbacks
// Supports both naming conventions:
// - EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred)
// - EXPO_PUBLIC_SUPABASE_ANON_KEY (legacy/alternative)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key';

// Log warning if using placeholder values
if (!process.env.EXPO_PUBLIC_SUPABASE_URL ||
    (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn(
    '[Supabase] Using placeholder credentials. Set EXPO_PUBLIC_SUPABASE_URL and ' +
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file for production use.'
  );
}

/**
 * In-memory storage fallback for when SecureStore is unavailable
 */
const memoryStorage: Record<string, string> = {};

/**
 * Custom storage adapter using Expo SecureStore for native platforms
 * Falls back to localStorage for web platform, and in-memory for Expo Go issues
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return memoryStorage[key] || null;
      }
      // Use SecureStore for native platforms
      const value = await SecureStore.getItemAsync(key);
      return value;
    } catch (error) {
      console.warn('[SecureStore] getItem failed, using memory fallback:', error);
      return memoryStorage[key] || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        } else {
          memoryStorage[key] = value;
        }
        return;
      }
      // Use SecureStore for native platforms
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('[SecureStore] setItem failed, using memory fallback:', error);
      memoryStorage[key] = value;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        delete memoryStorage[key];
        return;
      }
      // Use SecureStore for native platforms
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('[SecureStore] removeItem failed:', error);
      delete memoryStorage[key];
    }
  },
};

/**
 * Supabase client instance with typed Database schema
 * Configured with:
 * - Secure storage for auth token persistence
 * - Auto refresh token enabled
 * - Persistent sessions enabled
 * - URL detection for deep linking disabled (handled by Expo Router)
 */
let supabaseClient: SupabaseClient<Database>;

try {
  supabaseClient = createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'x-app-name': 'love2learn',
        },
      },
    }
  );
  console.log('[Supabase] Client initialized successfully');
} catch (error) {
  console.error('[Supabase] Failed to initialize client:', error);
  // Create a minimal client that won't crash the app
  supabaseClient = createClient<Database>(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

export const supabase = supabaseClient;

/**
 * Helper function to get the current session
 * Returns null if no session exists
 */
export async function getSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting session:', error.message);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Unexpected error getting session:', error);
    return null;
  }
}

/**
 * Helper function to get the current user
 * Returns null if no user is authenticated
 */
export async function getUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting user:', error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Unexpected error getting user:', error);
    return null;
  }
}

// Export typed client for use throughout the app
export type TypedSupabaseClient = typeof supabase;
