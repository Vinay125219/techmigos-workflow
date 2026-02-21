"use client";
import React, { createContext, useContext } from 'react';
import { useBackendAuth } from '@/hooks/useAuth';
import type { Profile, AppRole } from '@/types/database';
import type { AuthUser, AuthSession } from '@/types/auth';

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<any>;
  updateProfile: (updates: Partial<Profile>) => Promise<any>;
  refetchUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useBackendAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
