/**
 * Authentication Context
 * Love2Learn Tutoring App
 *
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  useAuth as useAuthHook,
  signIn,
  signUp,
  signOut,
  resetPassword,
  AuthResponse,
} from '../lib/auth';
import { Parent, UserRole } from '../types/database';

// Storage key for cached role
const CACHED_ROLE_KEY = 'love2learn_cached_role';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  parent: Parent | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Role helpers
  role: UserRole;
  isTutor: boolean;
  isParent: boolean;
  // Error state
  parentQueryError: 'timeout' | 'not_found' | 'query_error' | null;
  // Auth methods
  signIn: (email: string, password: string) => Promise<AuthResponse<Session>>;
  signUp: (email: string, password: string, name: string, invitationToken?: string) => Promise<AuthResponse<Session>>;
  signOut: () => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<AuthResponse>;
  // Parent data refresh
  refreshParent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to get cached role from storage
async function getCachedRole(userId: string): Promise<UserRole | null> {
  try {
    const key = `${CACHED_ROLE_KEY}_${userId}`;
    if (Platform.OS === 'web') {
      const cached = localStorage.getItem(key);
      return cached as UserRole | null;
    } else {
      const cached = await SecureStore.getItemAsync(key);
      return cached as UserRole | null;
    }
  } catch {
    return null;
  }
}

// Helper to set cached role in storage
async function setCachedRole(userId: string, role: UserRole): Promise<void> {
  try {
    const key = `${CACHED_ROLE_KEY}_${userId}`;
    if (Platform.OS === 'web') {
      localStorage.setItem(key, role);
    } else {
      await SecureStore.setItemAsync(key, role);
    }
  } catch {
    // Ignore storage errors
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authState = useAuthHook();
  const [cachedRole, setCachedRoleState] = useState<UserRole | null>(null);

  // Load cached role when user changes
  useEffect(() => {
    async function loadCachedRole() {
      if (authState.user?.id) {
        const cached = await getCachedRole(authState.user.id);
        setCachedRoleState(cached);
      } else {
        setCachedRoleState(null);
      }
    }
    loadCachedRole();
  }, [authState.user?.id]);

  // Update cached role when parent data is successfully fetched
  useEffect(() => {
    async function updateCachedRole() {
      if (authState.user?.id && authState.parent?.role) {
        await setCachedRole(authState.user.id, authState.parent.role);
        setCachedRoleState(authState.parent.role);
      }
    }
    updateCachedRole();
  }, [authState.user?.id, authState.parent?.role]);

  // Clear cached role on sign out
  useEffect(() => {
    if (!authState.isAuthenticated && cachedRole) {
      // User signed out, clear all cached roles
      setCachedRoleState(null);
    }
  }, [authState.isAuthenticated, cachedRole]);

  // Derive role from parent record
  // If parent query failed (timeout/error), use cached role to prevent incorrect redirects
  // Only default to 'parent' if we have no cached role and the query definitively found no record
  let role: UserRole;
  if (authState.parent?.role) {
    // We have fresh data from the database
    role = authState.parent.role;
  } else if (authState.parentQueryError === 'timeout' || authState.parentQueryError === 'query_error') {
    // Query failed - use cached role if available, otherwise keep loading
    // This prevents incorrect redirects when the database is slow
    role = cachedRole ?? 'parent';
    console.log('[AuthContext] Using cached role due to query error:', role, 'error:', authState.parentQueryError);
  } else if (authState.parentQueryError === 'not_found') {
    // No parent record found - this is a new user, default to parent
    role = 'parent';
  } else {
    // No error and no parent - use cached or default
    role = cachedRole ?? 'parent';
  }

  const isTutor = role === 'tutor';
  const isParent = role === 'parent';

  const value: AuthContextType = {
    ...authState,
    role,
    isTutor,
    isParent,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
