import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Profile, UserRole, AppRole } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export interface UserWithRoles extends Profile {
  roles: AppRole[];
}

export function useAdminUsers() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profileError } = await backend
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await backend
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;
      const allRoles = ((roles as unknown as UserRole[] | null) || []);

      // Combine profiles with their roles
      const usersWithRoles: UserWithRoles[] = ((profiles as unknown as Profile[]) || []).map(profile => ({
        ...profile,
        roles: allRoles
          .filter(r => r.user_id === profile.id)
          .map(r => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (err: unknown) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = async (userId: string, role: AppRole, add: boolean) => {
    if (!isAdmin) return { error: new Error('Not authorized') };

    if (add) {
      const { error } = await backend
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (!error) {
        await backend.from('role_history').insert({
          user_id: userId,
          changed_by: user?.id || null,
          role,
          change_type: 'granted',
          reason: 'Admin role change',
          created_at: new Date().toISOString(),
        });
        fetchUsers();
      }
      return { error };
    } else {
      const { error } = await backend
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (!error) {
        await backend.from('role_history').insert({
          user_id: userId,
          changed_by: user?.id || null,
          role,
          change_type: 'revoked',
          reason: 'Admin role removal',
          created_at: new Date().toISOString(),
        });
        fetchUsers();
      }
      return { error };
    }
  };

  const updateUserProfile = async (userId: string, updates: Partial<Profile>) => {
    if (!isAdmin) return { error: new Error('Not authorized') };

    const { data, error } = await backend
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (!error) fetchUsers();
    return { data, error };
  };

  const removeUser = async (userId: string) => {
    if (!isAdmin) return { error: new Error('Not authorized') };
    if (!userId) return { error: new Error('Invalid user id') };
    if (userId === user?.id) return { error: new Error('You cannot remove your own account') };

    try {
      const response = await fetch('/api/admin/users/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        return { error: new Error(payload?.error || 'Failed to remove user') };
      }

      await fetchUsers();
      return { error: null };
    } catch (error) {
      return {
        error: new Error(error instanceof Error ? error.message : 'Failed to remove user'),
      };
    }
  };

  return {
    users,
    loading,
    error,
    fetchUsers,
    updateUserRole,
    updateUserProfile,
    removeUser,
  };
}
