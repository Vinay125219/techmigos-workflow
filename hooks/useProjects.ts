import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Project, Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';


export function useProjects() {
  const { user, isManager } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch task counts for each project
      const projectIds = data?.map(p => p.id) || [];
      if (projectIds.length > 0) {
        const { data: taskCounts } = await supabase
          .from('tasks')
          .select('project_id, status')
          .in('project_id', projectIds);

        const countMap: Record<string, { total: number; completed: number }> = {};
        taskCounts?.forEach(t => {
          if (t.project_id) {
            if (!countMap[t.project_id]) {
              countMap[t.project_id] = { total: 0, completed: 0 };
            }
            countMap[t.project_id].total++;
            if (t.status === 'completed') {
              countMap[t.project_id].completed++;
            }
          }
        });

        const projectsWithCounts = (data || []).map(p => ({
          ...p,
          task_count: countMap[p.id]?.total || 0,
          completed_tasks: countMap[p.id]?.completed || 0,
        })) as Project[];

        setProjects(projectsWithCounts);
      } else {
        setProjects((data || []) as Project[]);
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  const createProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can create projects') };

    const { data, error } = await supabase
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
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          // Notify all users about new project (except creator)
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, email')
            .neq('id', user.id);

          if (allProfiles && allProfiles.length > 0) {
            const notifications = allProfiles.map(p => ({
              user_id: p.id,
              type: 'new_project',
              title: 'New Project Created',
              message: `"${data.name}" was created by ${creatorProfile?.full_name || 'someone'}`,
              entity_type: 'project',
              entity_id: data.id,
            }));

            await supabase.from('notifications').insert(notifications);
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

    const { data, error } = await supabase
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
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user!.id)
            .single();

          // Notify all users about project update (except creator)
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('id, email')
            .neq('id', user!.id);

          if (allProfiles && allProfiles.length > 0) {
            const notifications = allProfiles.map(p => ({
              user_id: p.id,
              type: 'project_update',
              title: 'Project Updated',
              message: `"${data.name}" was updated by ${creatorProfile?.full_name || 'someone'}`,
              entity_type: 'project',
              entity_id: data.id,
            }));

            await supabase.from('notifications').insert(notifications);
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

    const { error } = await supabase
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
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
