import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Workspace, WorkspaceMember, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useWorkspaces() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch member counts and project counts
      const workspaceIds = (data || []).map(w => w.id);

      if (workspaceIds.length > 0) {
        const [membersResult, projectsResult, ownersResult] = await Promise.all([
          supabase.from('workspace_members').select('workspace_id').in('workspace_id', workspaceIds),
          supabase.from('projects').select('workspace_id').in('workspace_id', workspaceIds),
          supabase.from('profiles').select('*').in('id', data?.map(w => w.owner_id) || []),
        ]);

        const memberCounts: Record<string, number> = {};
        const projectCounts: Record<string, number> = {};
        const ownerMap: Record<string, Profile> = {};

        (membersResult.data || []).forEach(m => {
          memberCounts[m.workspace_id] = (memberCounts[m.workspace_id] || 0) + 1;
        });

        (projectsResult.data || []).forEach(p => {
          if (p.workspace_id) {
            projectCounts[p.workspace_id] = (projectCounts[p.workspace_id] || 0) + 1;
          }
        });

        (ownersResult.data || []).forEach(p => {
          ownerMap[p.id] = p as Profile;
        });

        const workspacesWithCounts = (data || []).map(w => ({
          ...w,
          member_count: memberCounts[w.id] || 0,
          project_count: projectCounts[w.id] || 0,
          owner: ownerMap[w.owner_id],
        })) as Workspace[];

        setWorkspaces(workspacesWithCounts);
      } else {
        setWorkspaces([]);
      }
    } catch (err: unknown) {
      console.error('Error fetching workspaces:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaces();

    if (user) {
      const channel = supabase
        .channel('workspaces-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
          fetchWorkspaces();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => {
          fetchWorkspaces();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchWorkspaces, user]);

  const createWorkspace = async (workspace: { name: string; description?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('workspaces')
      .insert({ ...workspace, owner_id: user.id })
      .select()
      .single();

    if (error) return { data: null, error };

    try {
      // Add creator as owner member
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: data.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      fetchWorkspaces();
      return { data, error: null };
    } catch (err: any) {
      console.error('Error adding workspace owner:', err);
      // Rollback workspace creation if member addition fails
      await supabase.from('workspaces').delete().eq('id', data.id);
      return { data: null, error: err };
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<Workspace>) => {
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) fetchWorkspaces();
    return { data, error };
  };

  const deleteWorkspace = async (id: string) => {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (!error) setWorkspaces(prev => prev.filter(w => w.id !== id));
    return { error };
  };

  return {
    workspaces,
    loading,
    error,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      const userIds = (data || []).map(m => m.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', userIds)
        : { data: [] };

      const profileMap: Record<string, Profile> = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p as Profile;
      });

      const membersWithProfiles = (data || []).map(m => ({
        ...m,
        user: profileMap[m.user_id],
      })) as WorkspaceMember[];

      setMembers(membersWithProfiles);
    } catch (err) {
      console.error('Error fetching workspace members:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();

    if (workspaceId) {
      const channel = supabase
        .channel(`workspace-members-${workspaceId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`
        }, () => {
          fetchMembers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchMembers, workspaceId]);

  const addMember = async (email: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
    if (!workspaceId) return { error: new Error('No workspace selected') };

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) return { error: profileError };
    if (!profile) return { error: new Error('User not found with that email') };

    const { data, error } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: profile.id, role })
      .select()
      .single();

    if (!error) {
      fetchMembers();

      // Notify the new member
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'workspace_invite',
        title: 'Workspace Invitation',
        message: `You've been added to a workspace`,
        entity_type: 'workspace',
        entity_id: workspaceId,
      });
    }

    return { data, error };
  };

  const updateMemberRole = async (memberId: string, role: 'admin' | 'member' | 'viewer') => {
    const { data, error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (!error) fetchMembers();
    return { data, error };
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (!error) setMembers(prev => prev.filter(m => m.id !== memberId));
    return { error };
  };

  return {
    members,
    loading,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  };
}
