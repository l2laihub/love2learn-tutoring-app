/**
 * Supabase Client Configuration
 * Love2Learn Tutoring App
 *
 * Initializes the Supabase client with Expo secure storage for auth persistence
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
 * SecureStore has a 2048 byte limit on iOS.
 * Supabase session JWTs are typically larger than this.
 * We use AsyncStorage for session data (which can be large).
 *
 * For production apps requiring higher security, consider implementing
 * the full AES encryption approach from Supabase docs:
 * https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
 */

/**
 * In-memory storage fallback for when storage is unavailable
 */
const memoryStorage: Record<string, string> = {};

/**
 * Custom storage adapter using AsyncStorage for large values (session data)
 * and SecureStore for small values. Falls back to localStorage for web.
 *
 * Note: For production apps requiring maximum security, consider implementing
 * the full AES encryption approach where:
 * - Encryption key is stored in SecureStore (small)
 * - Encrypted session data is stored in AsyncStorage (large)
 */
const ExpoHybridStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        // Use localStorage for web
        if (typeof localStorage !== 'undefined') {
          return localStorage.getItem(key);
        }
        return memoryStorage[key] || null;
      }

      // For native platforms, try AsyncStorage first (for large session data)
      // then fall back to SecureStore (for migration from old storage)
      let value = await AsyncStorage.getItem(key);

      if (value === null) {
        // Try SecureStore as fallback (for migration from old implementation)
        try {
          value = await SecureStore.getItemAsync(key);
          if (value !== null) {
            // Migrate to AsyncStorage for future reads
            await AsyncStorage.setItem(key, value);
            // Clean up SecureStore
            await SecureStore.deleteItemAsync(key);
            console.log('[Storage] Migrated key from SecureStore to AsyncStorage:', key);
          }
        } catch {
          // SecureStore may fail for various reasons, ignore
        }
      }

      return value;
    } catch (error) {
      console.warn('[Storage] getItem failed, using memory fallback:', error);
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

      // For native platforms, use AsyncStorage for all values
      // This avoids the SecureStore 2048 byte limit issue
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('[Storage] setItem failed, using memory fallback:', error);
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

      // Remove from both storages to ensure cleanup
      await AsyncStorage.removeItem(key);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore SecureStore errors on delete
      }
    } catch (error) {
      console.warn('[Storage] removeItem failed:', error);
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
 * - URL detection enabled for web (for password recovery flows)
 */
let supabaseClient: SupabaseClient<Database>;

try {
  supabaseClient = createClient<Database>(
    supabaseUrl,
    supabasePublishableKey,
    {
      auth: {
        storage: ExpoHybridStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        // Enable URL detection for web to handle password recovery redirects
        detectSessionInUrl: Platform.OS === 'web',
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
