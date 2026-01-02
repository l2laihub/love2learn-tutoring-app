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
import { supabase } from './supabase';
import { Parent } from '../types/database';

/**
 * Auth state interface
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  parent: Parent | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
 * Creates both auth user and parent record
 *
 * @param email - User's email address
 * @param password - User's password
 * @param name - User's full name
 * @returns AuthResponse with session data or error
 */
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse<Session>> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: name.trim(),
        },
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

    // Create parent record
    const { error: parentError } = await supabase.from('parents').insert({
      user_id: authData.user.id,
      name: name.trim(),
      email: normalizedEmail,
    });

    if (parentError) {
      console.error('Error creating parent record:', parentError);
      // Note: Auth user was created but parent record failed
      // The user can still sign in, and we can retry parent creation later
      return {
        data: authData.session,
        error: new Error(
          `Account created but profile setup failed: ${parentError.message}`
        ),
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
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: 'love2learn://reset-password',
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
  try {
    const { data, error } = await supabase
      .from('parents')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching parent:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching parent:', error);
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchParent = useCallback(async (userId: string) => {
    const parentData = await getParentByUserId(userId);
    setParent(parentData);
  }, []);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchParent(initialSession.user.id);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
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
