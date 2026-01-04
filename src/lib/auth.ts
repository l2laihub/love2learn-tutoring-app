/**
 * Authentication Helpers
 * Love2Learn Tutoring App
 *
 * Provides authentication functions and hooks for managing user sessions
 */

import { useEffect, useState, useCallback } from 'react';
import {
  User,
  Session,
  AuthError,
  AuthChangeEvent,
} from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { Parent } from '../types/database';

/**
 * Get the appropriate redirect URL based on platform
 * For web, uses the current origin; for native, uses deep link
 */
function getPasswordResetRedirectUrl(): string {
  if (Platform.OS === 'web') {
    // For web, redirect to the reset-password page
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/(auth)/reset-password`;
    }
    return 'http://localhost:8081/(auth)/reset-password';
  }
  // For native apps, use deep link
  return 'love2learn://reset-password';
}

/**
 * Auth state interface
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  parent: Parent | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Refresh parent data from database */
  refreshParent: () => Promise<void>;
}

/**
 * Auth error response
 */
export interface AuthResponse<T = void> {
  data: T | null;
  error: AuthError | Error | null;
}

/**
 * Sign in with email and password
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns AuthResponse with session data or error
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse<Session>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return { data: null, error };
    }

    return { data: data.session, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown sign in error'),
    };
  }
}

/**
 * Sign up with email, password, and name
 * Creates auth user - parent record is created automatically via database trigger
 *
 * @param email - User's email address
 * @param password - User's password
 * @param name - User's full name
 * @param invitationToken - Optional invitation token for linking to existing parent record
 * @returns AuthResponse with session data or error
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  invitationToken?: string
): Promise<AuthResponse<Session>> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Build user metadata
    const userData: Record<string, string> = {
      name: name.trim(),
    };

    // Include invitation token if provided
    // The handle_new_user trigger will use this to link the auth user to existing parent record
    if (invitationToken) {
      userData.invitation_token = invitationToken;
    }

    // Create auth user
    // The parent record is created automatically via database trigger (handle_new_user)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: userData,
      },
    });

    if (authError) {
      return { data: null, error: authError };
    }

    if (!authData.user) {
      return {
        data: null,
        error: new Error('User creation failed - no user returned'),
      };
    }

    return { data: authData.session, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown sign up error'),
    };
  }
}

/**
 * Sign out the current user
 *
 * @returns AuthResponse indicating success or error
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown sign out error'),
    };
  }
}

/**
 * Get the currently authenticated user
 *
 * @returns AuthResponse with user data or error
 */
export async function getCurrentUser(): Promise<AuthResponse<User>> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return { data: null, error };
    }

    return { data: user, error: null };
  } catch (error) {
    console.error('Get current user error:', error);
    return {
      data: null,
      error:
        error instanceof Error ? error : new Error('Unknown get user error'),
    };
  }
}

/**
 * Send password reset email
 *
 * @param email - User's email address
 * @returns AuthResponse indicating success or error
 */
export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const redirectUrl = getPasswordResetRedirectUrl();
    console.log('[resetPassword] Using redirect URL:', redirectUrl);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: redirectUrl,
      }
    );

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Unknown reset password error'),
    };
  }
}

/**
 * Update user password (when user is authenticated)
 *
 * @param newPassword - The new password
 * @returns AuthResponse indicating success or error
 */
export async function updatePassword(
  newPassword: string
): Promise<AuthResponse<User>> {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { data: null, error };
    }

    return { data: data.user, error: null };
  } catch (error) {
    console.error('Update password error:', error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Unknown update password error'),
    };
  }
}

/**
 * Get the parent record for the current user
 *
 * @param userId - The user's auth ID
 * @returns Parent record or null
 */
export async function getParentByUserId(
  userId: string
): Promise<Parent | null> {
  console.log('[getParentByUserId] Starting query for:', userId);
  try {
    // Add timeout to detect hanging queries
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Parent query timeout after 10s')), 10000);
    });

    const queryPromise = supabase
      .from('parents')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>;

    console.log('[getParentByUserId] Query result:', { hasData: !!data, role: data?.role, error: error?.message });

    if (error) {
      console.error('[getParentByUserId] Error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[getParentByUserId] Unexpected error:', error);
    return null;
  }
}

/**
 * React hook for managing authentication state
 * Provides current user, session, and loading state
 * Automatically updates when auth state changes
 *
 * @returns AuthState object with user, session, parent, loading, and authenticated status
 */
export function useAuth(): AuthState {
  console.log('[useAuth] Hook called');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchParent = useCallback(async (userId: string) => {
    console.log('[useAuth] Fetching parent for:', userId);
    const parentData = await getParentByUserId(userId);
    console.log('[useAuth] Parent result:', parentData?.role);
    setParent(parentData);
  }, []);

  // Function to refresh parent data (useful after onboarding completion)
  const refreshParent = useCallback(async () => {
    if (user?.id) {
      console.log('[useAuth] Refreshing parent data');
      await fetchParent(user.id);
    }
  }, [user?.id, fetchParent]);

  useEffect(() => {
    // Get initial session with timeout to prevent hanging
    const initializeAuth = async () => {
      console.log('[useAuth] initializeAuth starting...');
      try {
        // Add timeout to prevent infinite hang
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('getSession timeout after 5s')), 5000);
        });

        const sessionPromise = supabase.auth.getSession();

        const { data: { session: initialSession } } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as Awaited<typeof sessionPromise>;

        console.log('[useAuth] getSession result:', !!initialSession);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchParent(initialSession.user.id);
        }
      } catch (error) {
        console.error('[useAuth] Error initializing auth:', error);
        // On timeout or error, set session to null and continue
        setSession(null);
        setUser(null);
        setParent(null);
      } finally {
        setIsLoading(false);
        console.log('[useAuth] Auth initialization complete, isLoading set to false');
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchParent(newSession.user.id);
        } else {
          setParent(null);
        }

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            console.log('User signed in');
            break;
          case 'SIGNED_OUT':
            console.log('User signed out');
            setParent(null);
            break;
          case 'TOKEN_REFRESHED':
            console.log('Token refreshed');
            break;
          case 'USER_UPDATED':
            console.log('User updated');
            break;
          case 'PASSWORD_RECOVERY':
            console.log('Password recovery initiated');
            break;
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchParent]);

  return {
    user,
    session,
    parent,
    isLoading,
    isAuthenticated: !!session && !!user,
    refreshParent,
  };
}

/**
 * Verify if current session is valid
 * Useful for protected route guards
 *
 * @returns boolean indicating if session is valid
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session && new Date(session.expires_at! * 1000) > new Date();
  } catch {
    return false;
  }
}

/**
 * Refresh the current session token
 *
 * @returns AuthResponse with refreshed session or error
 */
export async function refreshSession(): Promise<AuthResponse<Session>> {
  try {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      return { data: null, error };
    }

    return { data: data.session, error: null };
  } catch (error) {
    console.error('Refresh session error:', error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error('Unknown refresh session error'),
    };
  }
}
