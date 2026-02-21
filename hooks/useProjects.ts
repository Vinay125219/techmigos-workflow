import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Project, Profile, Task } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseProjectsOptions {
  workspaceId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { user, isManager, isAdmin } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      let query = backend
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.workspaceId) {
        query = query.eq('workspace_id', options.workspaceId);
      }
      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.category) {
        query = query.eq('category', options.category);
      }
      if (options.search && options.search.trim()) {
        query = query.search('name', options.search.trim());
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;
      const projectsData = (data || []) as Project[];
      setTotalCount(count || projectsData.length);

      // Fetch task counts for each project
      const projectIds = projectsData.map((project) => project.id);
      if (projectIds.length > 0) {
        const { data: taskCounts } = await backend
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projectIds);

        const countMap: Record<string, { total: number; completed: number }> = {};
        ((taskCounts || []) as Pick<Task, 'project_id' | 'status'>[]).forEach((task) => {
          if (task.project_id) {
            if (!countMap[task.project_id]) {
              countMap[task.project_id] = { total: 0, completed: 0 };
            }
            countMap[task.project_id].total++;
            if (task.status === 'completed') {
              countMap[task.project_id].completed++;
            }
          }
        });

        const projectsWithCounts = projectsData.map((project) => ({
          ...project,
          task_count: countMap[project.id]?.total || 0,
          completed_tasks: countMap[project.id]?.completed || 0,
        })) as Project[];

        setProjects(projectsWithCounts);
      } else {
        setProjects(projectsData);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.workspaceId, options.status, options.category, options.search, offset, pageSize]);

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime updates
    const channel = backend
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [fetchProjects]);

  const createProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can create projects') };

    const { data, error } = await backend
      .from('projects')
      .insert({ ...project, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      // Optimistic update - immediately add to local state
      setProjects(prev => [data as Project, ...prev]);

      // Fire-and-forget: Run side effects (notifications, emails) in background
      // This prevents blocking the UI update
      (async () => {
        try {
          // Get creator profile for notification
          const { data: creatorProfile } = await backend
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          // Notify all users about new project (except creator)
          const { data: allProfiles } = await backend
            .from('profiles')
            .select('id, email')
            .neq('id', user.id);

          const profilesToNotify = (allProfiles || []) as Pick<Profile, 'id'>[];
          if (profilesToNotify.length > 0) {
            const notifications = profilesToNotify.map((profile) => ({
              user_id: profile.id,
              type: 'new_project',
              title: 'New Project Created',
              message: `"${data.name}" was created by ${creatorProfile?.full_name || 'someone'}`,
              entity_type: 'project',
              entity_id: data.id,
            }));

            await backend.from('notifications').insert(notifications);
          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      })();
    }

    return { data, error };
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can update projects') };

    // Optimistic update - immediately update UI
    const previousProjects = projects;
    setProjects(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ));

    const { data, error } = await backend
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Rollback on error
      setProjects(previousProjects);
    } else if (data) {
      // Fire-and-forget: Send notifications
      (async () => {
        try {
          const { data: creatorProfile } = await backend
            .from('profiles')
            .select('full_name')
            .eq('id', user!.id)
            .single();

          // Notify all users about project update (except creator)
          const { data: allProfiles } = await backend
            .from('profiles')
            .select('id, email')
            .neq('id', user!.id);

          const profilesToNotify = (allProfiles || []) as Pick<Profile, 'id'>[];
          if (profilesToNotify.length > 0) {
            const notifications = profilesToNotify.map((profile) => ({
              user_id: profile.id,
              type: 'project_update',
              title: 'Project Updated',
              message: `"${data.name}" was updated by ${creatorProfile?.full_name || 'someone'}`,
              entity_type: 'project',
              entity_id: data.id,
            }));

            await backend.from('notifications').insert(notifications);
          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      })();
    }

    return { data, error };
  };

  const deleteProject = async (id: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can delete projects') };

    if (!isAdmin) {
      const project = projects.find((item) => item.id === id);
      const { error } = await backend
        .from('governance_actions')
        .insert({
          action_type: 'delete_project',
          entity_type: 'project',
          entity_id: id,
          payload: { project_name: project?.name || 'Unknown project' },
          requested_by: user.id,
          status: 'pending',
          approved_by: null,
          approved_at: null,
        });

      return { error };
    }

    const { error } = await backend
      .from('projects')
      .delete()
      .eq('id', id);

    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }

    return { error };
  };

  return {
    projects,
    loading,
    error,
    page,
    pageSize,
    totalCount,
    hasMore: offset + projects.length < totalCount,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
