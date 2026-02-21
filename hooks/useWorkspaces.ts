import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Workspace, WorkspaceMember, Profile, Project } from '@/types/database';
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
      const { data: membershipRows, error: membershipError } = await backend
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (membershipError) throw membershipError;
      const workspaceIds = Array.from(
        new Set(((membershipRows || []) as Array<{ workspace_id: string }>).map((member) => member.workspace_id))
      );

      if (workspaceIds.length === 0) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const { data, error } = await backend
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const workspaceRows = (data || []) as Workspace[];

      // Fetch member counts and project counts
      const fetchedWorkspaceIds = workspaceRows.map((workspace) => workspace.id);

      if (fetchedWorkspaceIds.length > 0) {
        const [membersResult, projectsResult, ownersResult] = await Promise.all([
          backend.from('workspace_members').select('workspace_id').in('workspace_id', fetchedWorkspaceIds),
          backend.from('projects').select('workspace_id').in('workspace_id', fetchedWorkspaceIds),
          backend.from('profiles').select('*').in('id', workspaceRows.map((workspace) => workspace.owner_id)),
        ]);

        const memberCounts: Record<string, number> = {};
        const projectCounts: Record<string, number> = {};
        const ownerMap: Record<string, Profile> = {};

        ((membersResult.data || []) as Pick<WorkspaceMember, 'workspace_id'>[]).forEach((member) => {
          memberCounts[member.workspace_id] = (memberCounts[member.workspace_id] || 0) + 1;
        });

        ((projectsResult.data || []) as Pick<Project, 'workspace_id'>[]).forEach((project) => {
          if (project.workspace_id) {
            projectCounts[project.workspace_id] = (projectCounts[project.workspace_id] || 0) + 1;
          }
        });

        ((ownersResult.data || []) as Profile[]).forEach((ownerProfile) => {
          ownerMap[ownerProfile.id] = ownerProfile;
        });

        const workspacesWithCounts = workspaceRows.map((workspace) => ({
          ...workspace,
          member_count: memberCounts[workspace.id] || 0,
          project_count: projectCounts[workspace.id] || 0,
          owner: ownerMap[workspace.owner_id],
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
      const channel = backend
        .channel('workspaces-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
          fetchWorkspaces();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => {
          fetchWorkspaces();
        })
        .subscribe();

      return () => {
        backend.removeChannel(channel);
      };
    }
  }, [fetchWorkspaces, user]);

  const createWorkspace = async (workspace: { name: string; description?: string }) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await backend
      .from('workspaces')
      .insert({ ...workspace, owner_id: user.id })
      .select()
      .single();

    if (error) return { data: null, error };

    try {
      // Add creator as owner member
      const { error: memberError } = await backend
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
      await backend.from('workspaces').delete().eq('id', data.id);
      return { data: null, error: err };
    }
  };

  const updateWorkspace = async (id: string, updates: Partial<Workspace>) => {
    const { data, error } = await backend
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error) fetchWorkspaces();
    return { data, error };
  };

  const deleteWorkspace = async (id: string) => {
    const { error } = await backend
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
      const { data, error } = await backend
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const memberRows = (data || []) as WorkspaceMember[];

      // Fetch user profiles
      const userIds = memberRows.map((member) => member.user_id);
      const { data: profiles } = userIds.length > 0
        ? await backend.from('profiles').select('*').in('id', userIds)
        : { data: [] };

      const profileMap: Record<string, Profile> = {};
      ((profiles || []) as Profile[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const membersWithProfiles = memberRows.map((member) => ({
        ...member,
        user: profileMap[member.user_id],
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
      const channel = backend
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
        backend.removeChannel(channel);
      };
    }
  }, [fetchMembers, workspaceId]);

  const addMember = async (email: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
    if (!workspaceId) return { error: new Error('No workspace selected') };

    // Find user by email
    const { data: profile, error: profileError } = await backend
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileError) return { error: profileError };
    if (!profile) return { error: new Error('User not found with that email') };

    const { data, error } = await backend
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: profile.id, role })
      .select()
      .single();

    if (!error) {
      fetchMembers();

      // Notify the new member
      await backend.from('notifications').insert({
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
    const { data, error } = await backend
      .from('workspace_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (!error) fetchMembers();
    return { data, error };
  };

  const removeMember = async (memberId: string) => {
    const { error } = await backend
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
