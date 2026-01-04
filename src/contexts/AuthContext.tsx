/**
 * Authentication Context
 * Love2Learn Tutoring App
 *
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import {
  useAuth as useAuthHook,
  signIn,
  signUp,
  signOut,
  resetPassword,
  AuthResponse,
} from '../lib/auth';
import { Parent, UserRole } from '../types/database';

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
  // Auth methods
  signIn: (email: string, password: string) => Promise<AuthResponse<Session>>;
  signUp: (email: string, password: string, name: string, invitationToken?: string) => Promise<AuthResponse<Session>>;
  signOut: () => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authState = useAuthHook();

  // Derive role from parent record (defaults to 'parent' if not set)
  const role: UserRole = authState.parent?.role ?? 'parent';
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
