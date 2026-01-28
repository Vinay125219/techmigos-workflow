import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Task, TaskProgress, Profile, Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast'; // Added toast import

export interface TaskProgressWithAttachments extends TaskProgress {
  attachments?: string[];
}

export function useTasks(projectId?: string) {
  const { user, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      if (tasks.length === 0) setLoading(true);
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: tasksData, error } = await query;
      if (error) throw error;

      // Fetch related profiles and projects
      const assigneeIds = [...new Set((tasksData || []).filter(t => t.assigned_to).map(t => t.assigned_to as string))];
      const projectIds = [...new Set((tasksData || []).filter(t => t.project_id).map(t => t.project_id as string))];

      const [profilesResult, projectsResult] = await Promise.all([
        assigneeIds.length > 0
          ? supabase.from('profiles').select('*').in('id', assigneeIds)
          : { data: [] },
        projectIds.length > 0
          ? supabase.from('projects').select('*').in('id', projectIds)
          : { data: [] },
      ]);

      const profileMap: Record<string, Profile> = {};
      (profilesResult.data || []).forEach(p => {
        profileMap[p.id] = p as Profile;
      });

      const projectMap: Record<string, Project> = {};
      (projectsResult.data || []).forEach(p => {
        projectMap[p.id] = p as Project;
      });

      const tasksWithRelations = (tasksData || []).map(t => ({
        ...t,
        assignee: t.assigned_to ? profileMap[t.assigned_to] : undefined,
        project: t.project_id ? projectMap[t.project_id] : undefined,
      })) as Task[];

      setTasks(tasksWithRelations);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'project' | 'assignee' | 'creator'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can create tasks') };

    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...task, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      // Optimistic update - immediately add to local state
      setTasks(prev => [data as Task, ...prev]);

      // Fire-and-forget: Run side effects (notifications, emails) in background
      (async () => {
        try {
          // Get creator profile for notification
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          // If task was assigned during creation, notify the assignee
          if (data.assigned_to) {
            const { data: assigneeProfile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('id', data.assigned_to)
              .single();

            if (assigneeProfile) {
              await supabase.from('notifications').insert({
                user_id: data.assigned_to,
                type: 'new_assignment',
                title: 'New Task Assignment',
                message: `You have been assigned to "${data.title}" by ${creatorProfile?.full_name || 'a manager'}`,
                entity_type: 'task',
                entity_id: data.id,
              });
            }

            // Notify all users about new task (except creator and assignee)
            const { data: allProfiles } = await supabase
              .from('profiles')
              .select('id, email')
              .neq('id', user.id)
              .neq('id', data.assigned_to || ''); // Exclude assignee if exists

            if (allProfiles && allProfiles.length > 0) {
              const notifications = allProfiles.map(p => ({
                user_id: p.id,
                type: 'new_task',
                title: 'New Task Available',
                message: `"${data.title}" was created by ${creatorProfile?.full_name || 'someone'}`,
                entity_type: 'task',
                entity_id: data.id,
              }));

              await supabase.from('notifications').insert(notifications);
            }
          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      })();
    }

    return { data, error };
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    // Remove virtual fields before updating
    const { project, assignee, creator, ...cleanUpdates } = updates;

    // Optimistic update - immediately update UI
    const previousTasks = tasks;
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...cleanUpdates } : t
    ));

    const { data, error } = await supabase
      .from('tasks')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Rollback on error
      setTasks(previousTasks);
    }

    return { data, error };
  };

  const assignTask = async (taskId: string, userId: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers can assign tasks') };

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, assigned_to: userId, status: 'in-progress' as const } : t
    ));

    const { data, error } = await supabase
      .from('tasks')
      .update({ assigned_to: userId, status: 'in-progress' })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      // Rollback on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, assigned_to: null, status: 'open' as const } : t
      ));
      toast({
        variant: "destructive",
        title: "Assignment failed",
        description: error.message
      });
    } else if (data) {
      toast({ title: "Assigned", description: "Task assigned successfully" });

      // Notifications
      (async () => {
        try {
          const { data: managerProfile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
          const { data: assigneeProfile } = await supabase.from('profiles').select('email').eq('id', userId).single();

          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'task_assigned',
            title: 'Task Assigned',
            message: `You have been assigned to "${data.title}" by ${managerProfile?.full_name || 'a manager'}`,
            entity_type: 'task',
            entity_id: taskId,
          });
        } catch (e) {
          console.error("Error sending assignment notifications", e);
        }
      })();
    }
    return { data, error };
  };

  const takeTask = async (taskId: string) => {
    if (!user) return { error: new Error('Not authenticated') };

    // Optimistic update - immediately update UI
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, assigned_to: user.id, status: 'in-progress' as const } : t
    ));

    const { data, error } = await supabase
      .from('tasks')
      .update({ assigned_to: user.id, status: 'in-progress' })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      // Rollback on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, assigned_to: null, status: 'open' as const } : t
      ));
    } else if (data) {
      // Fire-and-forget: Send notifications in background
      (async () => {
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (data.created_by && data.created_by !== user.id) {
            await supabase.from('notifications').insert({
              user_id: data.created_by,
              type: 'task_taken',
              title: 'Task Assigned',
              message: `${userProfile?.full_name || 'Someone'} started working on "${data.title}"`,
              entity_type: 'task',
              entity_id: taskId,
            });

          }
        } catch (e) {
          console.error('Error sending notifications:', e);
        }
      })();
    }

    return { data, error };
  };

  const releaseTask = async (taskId: string) => {
    // Optimistic update - immediately update UI
    const previousTasks = tasks;
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, assigned_to: null, status: 'open' as const } : t
    ));

    const { data, error } = await supabase
      .from('tasks')
      .update({ assigned_to: null, status: 'open' })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      // Rollback on error
      setTasks(previousTasks);
    }

    return { data, error };
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }

    return { error };
  };

  const submitTask = async (taskId: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) throw error;

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'review' as const } : t
    ));

    toast({ title: "Submitted", description: "Task submitted for review" });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.created_by && task.created_by !== user.id) {
          const { data: creatorProfile } = await supabase.from('profiles').select('full_name, email').eq('id', task.created_by).single();

          await supabase.from('notifications').insert({
            user_id: task.created_by,
            type: 'task_submitted',
            title: 'Task Submitted',
            message: `"${task.title}" is ready for review`,
            entity_type: 'task',
            entity_id: taskId,
          });
        }
      } catch (e) {
        console.error('Error sending submit notifications:', e);
      }
    })();
  };

  const approveTask = async (taskId: string) => {
    if (!user) throw new Error('Not authenticated');
    if (!isManager) throw new Error('Only Managers and Admins can approve tasks');

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) throw error;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t));
    toast({ title: "Approved", description: "Task approved and completed" });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.assigned_to && task.assigned_to !== user.id) {
          const { data: msgProfile } = await supabase.from('profiles').select('email, full_name').eq('id', task.assigned_to).single();

          await supabase.from('notifications').insert({
            user_id: task.assigned_to,
            type: 'task_approved',
            title: 'Task Approved',
            message: `Your task "${task.title}" has been approved!`,
            entity_type: 'task',
            entity_id: taskId,
          });
        }
      } catch (e) {
        console.error('Error sending approval notifications:', e);
      }
    })();
  };

  const completeTask = async (taskId: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) return { error };

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' as const } : t));

    // Notify Creator
    // Notification logic previously sent email to creator, now removed.
    // We can add in-app notification here later if needed.
    return { error: null };
  };

  const rejectTask = async (taskId: string) => {
    if (!user) throw new Error('Not authenticated');
    if (!isManager) throw new Error('Only Managers and Admins can reject tasks');

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'in-progress', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) throw error;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in-progress' as const } : t));
    toast({ title: "Returned", description: "Task returned to In Progress" });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.assigned_to && task.assigned_to !== user.id) {
          const { data: msgProfile } = await supabase.from('profiles').select('email').eq('id', task.assigned_to).single();

          await supabase.from('notifications').insert({
            user_id: task.assigned_to,
            type: 'task_rejected',
            title: 'Task Returned',
            message: `Task "${task.title}" was returned for revision`,
            entity_type: 'task',
            entity_id: taskId,
          });
        }
      } catch (e) {
        console.error('Error sending rejection notifications:', e);
      }
    })();
  };

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    takeTask,
    assignTask,
    releaseTask,
    submitTask,
    approveTask,
    rejectTask,
    deleteTask,
    completeTask,
  };
}

export function useTaskProgress(taskId?: string) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<TaskProgressWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchProgress = useCallback(async () => {
    if (!taskId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_progress')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles
      const userIds = [...new Set((data || []).map(p => p.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', userIds)
        : { data: [] };

      const profileMap: Record<string, Profile> = {};
      (profiles || []).forEach(p => {
        profileMap[p.id] = p as Profile;
      });

      const progressWithUsers = (data || []).map(p => ({
        ...p,
        user: profileMap[p.user_id],
      })) as TaskProgressWithAttachments[];

      setProgress(progressWithUsers);
    } catch (err) {
      console.error('Error fetching task progress:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchProgress();

    if (taskId) {
      const channel = supabase
        .channel(`task-progress-${taskId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'task_progress',
          filter: `task_id=eq.${taskId}`
        }, () => {
          fetchProgress();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchProgress, taskId]);

  const uploadAttachments = async (files: File[]): Promise<string[]> => {
    if (!user) return [];

    const urls: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(fileName);
        urls.push(publicUrl);
      }
    }

    return urls;
  };

  const addProgress = async (
    content: string,
    hoursWorked: number,
    progressPercentage: number,
    files?: File[]
  ) => {
    if (!user || !taskId) return { error: new Error('Missing required data') };

    setUploading(true);

    let attachmentUrls: string[] = [];
    if (files && files.length > 0) {
      attachmentUrls = await uploadAttachments(files);
    }

    const { data, error } = await supabase
      .from('task_progress')
      .insert({
        task_id: taskId,
        user_id: user.id,
        content,
        hours_worked: hoursWorked,
        progress_percentage: progressPercentage,
        attachments: attachmentUrls,
      })
      .select()
      .single();

    setUploading(false);

    if (!error) {
      fetchProgress();

      // Create notification for task progress
      const { data: taskData } = await supabase
        .from('tasks')
        .select('title, created_by, project_id')
        .eq('id', taskId)
        .single();

      if (taskData && taskData.created_by && taskData.created_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: taskData.created_by,
          type: 'task_progress',
          title: 'New Progress Update',
          message: `Progress update on "${taskData.title}": ${progressPercentage}% completed`,
          entity_type: 'task',
          entity_id: taskId,
        });
      }
    }

    return { data, error };
  };

  return {
    progress,
    loading,
    uploading,
    fetchProgress,
    addProgress,
  };
}
