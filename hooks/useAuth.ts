import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Profile, UserRole, AppRole } from '@/types/database';
import type { AuthUser, AuthSession } from '@/types/auth';
import {
  COMPANY_ACCESS_ERROR,
  getCompanyPolicyFromEnv,
  getCompanyPolicyFromSource,
  getPrivilegedEmailRole,
  isCompanyEmailAllowed,
  isMissingCollectionError as isMissingPolicyCollectionError,
  type CompanyPolicy,
} from '@/lib/company-policy';

const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim();
const appwriteSessionCookie = projectId ? `a_session_${projectId}` : null;
const localSessionMarkerCookie = 'tm_auth';
const authErrorStorageKey = 'tm_auth_error';
type CompanyPolicySource = 'remote' | 'env' | 'env-auth-fallback';

function isAuthUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as { status?: number; code?: number };
  return typed.status === 401 || typed.status === 403 || typed.code === 401 || typed.code === 403;
}

function buildDefaultProfile(user: AuthUser): Profile {
  const now = new Date().toISOString();
  const fallbackName = user.name?.trim() || (user.email ? user.email.split('@')[0] : 'New User');

  return {
    id: user.id,
    email: user.email || '',
    full_name: fallbackName,
    avatar_url: null,
    department: null,
    designation: null,
    skills: [],
    created_at: now,
    updated_at: now,
  };
}

function syncSessionMarkerCookie(authenticated: boolean): void {
  if (typeof document === 'undefined') return;

  const cookieSuffix = 'Path=/; SameSite=Lax';
  if (authenticated) {
    const maxAge = 60 * 60 * 24 * 30;
    document.cookie = `${localSessionMarkerCookie}=active; Max-Age=${maxAge}; ${cookieSuffix}`;

    if (appwriteSessionCookie) {
      document.cookie = `${appwriteSessionCookie}=active; Max-Age=${maxAge}; ${cookieSuffix}`;
      document.cookie = `${appwriteSessionCookie}_legacy=active; Max-Age=${maxAge}; ${cookieSuffix}`;
    }

    return;
  }

  document.cookie = `${localSessionMarkerCookie}=; Max-Age=0; ${cookieSuffix}`;

  if (appwriteSessionCookie) {
    document.cookie = `${appwriteSessionCookie}=; Max-Age=0; ${cookieSuffix}`;
    document.cookie = `${appwriteSessionCookie}_legacy=; Max-Age=0; ${cookieSuffix}`;
  }
}

function setAuthErrorMarker(message: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(authErrorStorageKey, message);
  } catch {
    // Ignore storage errors.
  }
}

function clearAuthErrorMarker(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(authErrorStorageKey);
  } catch {
    // Ignore storage errors.
  }
}

export function useBackendAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanyPolicy = useCallback(async (): Promise<{ policy: CompanyPolicy; source: CompanyPolicySource }> => {
    const envPolicy = getCompanyPolicyFromEnv();

    try {
      const { data, error } = await backend
        .from('company_policy')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isAuthUnavailableError(error)) {
          return { policy: envPolicy, source: 'env-auth-fallback' };
        }

        if (isMissingPolicyCollectionError(error)) {
          return { policy: envPolicy, source: 'env' };
        }

        console.warn('Failed to load company policy; falling back to env configuration.', error);
        return { policy: envPolicy, source: 'env' };
      }

      if (!data) {
        return { policy: envPolicy, source: 'env' };
      }

      return { policy: getCompanyPolicyFromSource(data as Record<string, unknown>), source: 'remote' };
    } catch (error) {
      if (isAuthUnavailableError(error)) {
        return { policy: envPolicy, source: 'env-auth-fallback' };
      }

      if (isMissingPolicyCollectionError(error)) {
        return { policy: envPolicy, source: 'env' };
      }

      console.warn('Company policy fetch threw unexpectedly; using env configuration.', error);
      return { policy: envPolicy, source: 'env' };
    }
  }, []);

  // Fetch profile and roles
  const fetchUserData = useCallback(async (authUser: AuthUser) => {
    try {
      const { policy } = await loadCompanyPolicy();
      const normalizedEmail = (authUser.email || '').toLowerCase();

      if (!isCompanyEmailAllowed(normalizedEmail, policy)) {
        await backend.auth.signOut();
        throw new Error(COMPANY_ACCESS_ERROR);
      }

      const [profileResult, rolesResult] = await Promise.all([
        backend.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        backend.from('user_roles').select('*').eq('user_id', authUser.id),
      ]);

      let nextProfile = profileResult.data as Profile | null;

      if (!nextProfile) {
        const defaultProfile = buildDefaultProfile(authUser);
        const createProfileResult = await backend
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .maybeSingle();

        nextProfile = (createProfileResult.data as Profile | null) || defaultProfile;
      }

      setProfile(nextProfile);

      let nextRoles = (rolesResult.data as UserRole[] | null)?.map((role) => role.role) || [];
      if (nextRoles.length === 0) {
        await backend.from('user_roles').insert({
          user_id: authUser.id,
          role: 'member',
        });
        nextRoles = ['member'];
      }

      const privilegedRole = getPrivilegedEmailRole(normalizedEmail);
      if (privilegedRole && !nextRoles.includes(privilegedRole)) {
        await backend.from('user_roles').insert({
          user_id: authUser.id,
          role: privilegedRole,
        });
        nextRoles = [...new Set([...nextRoles, privilegedRole])];
      }

      setRoles(nextRoles);
      clearAuthErrorMarker();
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (error instanceof Error && error.message === COMPANY_ACCESS_ERROR) {
        setAuthErrorMarker(COMPANY_ACCESS_ERROR);
        setUser(null);
        setSession(null);
        setProfile(null);
        setRoles([]);
      }
    }
  }, [loadCompanyPolicy]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = backend.auth.onAuthStateChange(
      (_event: string, session: AuthSession | null) => {
        syncSessionMarkerCookie(Boolean(session?.user));
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlock
          setTimeout(() => {
            fetchUserData(session.user);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    backend.auth.getSession().then(({ data: { session } }) => {
      syncSessionMarkerCookie(Boolean(session?.user));
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { policy, source } = await loadCompanyPolicy();
    if (source !== 'env-auth-fallback' && !isCompanyEmailAllowed(email, policy)) {
      setAuthErrorMarker(COMPANY_ACCESS_ERROR);
      return {
        data: null,
        error: new Error(COMPANY_ACCESS_ERROR),
      };
    }

    // Use dynamic URL for email confirmation redirect
    const redirectUrl = `${window.location.origin}/auth?confirmed=true`;

    const { data, error } = await backend.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data?.session?.user) {
      await fetchUserData(data.session.user as AuthUser);
    }

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { policy, source } = await loadCompanyPolicy();
    if (source !== 'env-auth-fallback' && !isCompanyEmailAllowed(email, policy)) {
      setAuthErrorMarker(COMPANY_ACCESS_ERROR);
      return {
        data: null,
        error: new Error(COMPANY_ACCESS_ERROR),
      };
    }

    const { data, error } = await backend.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data?.user) {
      await fetchUserData(data.user as AuthUser);
      clearAuthErrorMarker();
    }

    return { data, error };
  };

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth?oauth=success`;
    const failureRedirectTo = `${window.location.origin}/auth?oauth=error`;

    try {
      clearAuthErrorMarker();
      window.sessionStorage.setItem('tm_oauth_pending', '1');
    } catch {
      // Ignore storage errors in hardened/private browser modes.
    }

    const { data, error } = await backend.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        failureRedirectTo,
      },
    });

    if (error) {
      try {
        window.sessionStorage.removeItem('tm_oauth_pending');
      } catch {
        // Ignore storage errors.
      }
    }

    return { data, error };
  };

  const signOut = async () => {
    const { error } = await backend.auth.signOut();
    if (!error) {
      syncSessionMarkerCookie(false);
      clearAuthErrorMarker();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
    }
    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await backend
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (data) {
      setProfile(data as Profile);
    }

    return { data, error };
  };

  const isAdmin = roles.includes('admin');
  const isManager = roles.includes('manager') || isAdmin;

  return {
    user,
    session,
    profile,
    roles,
    loading,
    isAuthenticated: !!user,
    isAdmin,
    isManager,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    refetchUserData: () => user && fetchUserData(user),
  };
}
