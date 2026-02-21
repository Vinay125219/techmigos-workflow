import { useState, useEffect, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Task, TaskProgress, Profile, Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast'; // Added toast import
import {
  createApprovalRequest,
  approveTaskWithWorkflow,
  rejectTaskWithWorkflow,
} from '@/lib/approvals';

export interface TaskProgressWithAttachments extends TaskProgress {
  attachments?: string[];
}

interface UseTasksOptions {
  projectId?: string;
  workspaceId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  assignee?: string;
}

export function useTasks(projectOrOptions?: string | UseTasksOptions) {
  const options: UseTasksOptions = typeof projectOrOptions === 'string'
    ? { projectId: projectOrOptions }
    : (projectOrOptions || {});
  const { user, isManager } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 25);
  const offset = (page - 1) * pageSize;

  const fetchTasks = useCallback(async () => {
    try {
      if (tasks.length === 0) setLoading(true);
      let query = backend
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.projectId) {
        query = query.eq('project_id', options.projectId);
      }
      if (options.workspaceId) {
        query = query.eq('workspace_id', options.workspaceId);
      }
      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options.assignee && options.assignee !== 'all') {
        query = query.eq('assigned_to', options.assignee);
      }
      if (options.search && options.search.trim()) {
        query = query.search('title', options.search.trim());
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data: tasksData, error, count } = await query;
      if (error) throw error;
      const taskRows = (tasksData || []) as Task[];
      setTotalCount(count || taskRows.length);

      // Fetch related profiles and projects
      const assigneeIds = [
        ...new Set(taskRows.filter((task) => task.assigned_to).map((task) => task.assigned_to as string)),
      ];
      const projectIds = [
        ...new Set(taskRows.filter((task) => task.project_id).map((task) => task.project_id as string)),
      ];

      const [profilesResult, projectsResult] = await Promise.all([
        assigneeIds.length > 0
          ? backend.from('profiles').select('*').in('id', assigneeIds)
          : { data: [] },
        projectIds.length > 0
          ? backend.from('projects').select('*').in('id', projectIds)
          : { data: [] },
      ]);

      const profileMap: Record<string, Profile> = {};
      ((profilesResult.data || []) as Profile[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const projectMap: Record<string, Project> = {};
      ((projectsResult.data || []) as Project[]).forEach((project) => {
        projectMap[project.id] = project;
      });

      const tasksWithRelations = taskRows.map((task) => ({
        ...task,
        assignee: task.assigned_to ? profileMap[task.assigned_to] : undefined,
        project: task.project_id ? projectMap[task.project_id] : undefined,
      })) as Task[];

      setTasks(tasksWithRelations);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [options.projectId, options.workspaceId, options.status, options.assignee, options.search, offset, pageSize]);

  useEffect(() => {
    fetchTasks();

    // Subscribe to realtime updates
    const channel = backend
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [fetchTasks]);

  const createTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'project' | 'assignee' | 'creator'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager) return { error: new Error('Only Managers and Admins can create tasks') };

    const { data, error } = await backend
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
          const { data: creatorProfile } = await backend
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          // If task was assigned during creation, notify the assignee
          if (data.assigned_to) {
            const { data: assigneeProfile } = await backend
              .from('profiles')
              .select('email, full_name')
              .eq('id', data.assigned_to)
              .single();

            if (assigneeProfile) {
              await backend.from('notifications').insert({
                user_id: data.assigned_to,
                type: 'new_assignment',
                title: 'New Task Assignment',
                message: `You have been assigned to "${data.title}" by ${creatorProfile?.full_name || 'a manager'}`,
                entity_type: 'task',
                entity_id: data.id,
              });
            }

            // Notify all users about new task (except creator and assignee)
            const { data: allProfiles } = await backend
              .from('profiles')
              .select('id, email')
              .neq('id', user.id)
              .neq('id', data.assigned_to || ''); // Exclude assignee if exists

            const profilesToNotify = (allProfiles || []) as Pick<Profile, 'id'>[];
            if (profilesToNotify.length > 0) {
              const notifications = profilesToNotify.map((profile) => ({
                user_id: profile.id,
                type: 'new_task',
                title: 'New Task Available',
                message: `"${data.title}" was created by ${creatorProfile?.full_name || 'someone'}`,
                entity_type: 'task',
                entity_id: data.id,
              }));

              await backend.from('notifications').insert(notifications);
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

    const { data, error } = await backend
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

    const { data, error } = await backend
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
          const { data: managerProfile } = await backend.from('profiles').select('full_name').eq('id', user.id).single();
          const { data: assigneeProfile } = await backend.from('profiles').select('email').eq('id', userId).single();

          await backend.from('notifications').insert({
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

    const { data, error } = await backend
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
          const { data: userProfile } = await backend
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          if (data.created_by && data.created_by !== user.id) {
            await backend.from('notifications').insert({
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

    const { data, error } = await backend
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
    const { error } = await backend
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

    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const { error } = await backend
      .from('tasks')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) throw error;

    await createApprovalRequest(task, user.id);

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'review' as const } : t
    ));

    toast({ title: "Submitted", description: "Task submitted for review" });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.created_by && task.created_by !== user.id) {
          const { data: creatorProfile } = await backend.from('profiles').select('full_name, email').eq('id', task.created_by).single();

          await backend.from('notifications').insert({
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

    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found');

    const { error, completed } = await approveTaskWithWorkflow(task, user.id);
    if (error) throw error;

    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, status: completed ? ('completed' as const) : ('review' as const) }
          : item
      )
    );
    toast({
      title: "Approved",
      description: completed
        ? "Task reached required approvals and is now completed."
        : "Approval recorded. Waiting for remaining approvers.",
    });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.assigned_to && task.assigned_to !== user.id) {
          const { data: msgProfile } = await backend.from('profiles').select('email, full_name').eq('id', task.assigned_to).single();

          await backend.from('notifications').insert({
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

    const { error } = await backend
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

    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found');

    const { error } = await rejectTaskWithWorkflow(task, user.id);
    if (error) throw error;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'in-progress' as const } : t));
    toast({ title: "Returned", description: "Task returned to In Progress" });

    // Fire-and-forget: Notifications
    (async () => {
      try {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.assigned_to && task.assigned_to !== user.id) {
          const { data: msgProfile } = await backend.from('profiles').select('email').eq('id', task.assigned_to).single();

          await backend.from('notifications').insert({
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
    page,
    pageSize,
    totalCount,
    hasMore: offset + tasks.length < totalCount,
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
      const { data, error } = await backend
        .from('task_progress')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const progressRows = (data || []) as TaskProgressWithAttachments[];

      // Fetch user profiles
      const userIds = [...new Set(progressRows.map((progressItem) => progressItem.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await backend.from('profiles').select('*').in('id', userIds)
        : { data: [] };

      const profileMap: Record<string, Profile> = {};
      ((profiles || []) as Profile[]).forEach((profile) => {
        profileMap[profile.id] = profile;
      });

      const progressWithUsers = progressRows.map((progressItem) => ({
        ...progressItem,
        user: profileMap[progressItem.user_id],
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
      const channel = backend
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
        backend.removeChannel(channel);
      };
    }
  }, [fetchProgress, taskId]);

  const uploadAttachments = async (files: File[]): Promise<string[]> => {
    if (!user) return [];

    const urls: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await backend.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (!uploadError) {
        const { data: { publicUrl } } = backend.storage
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

    const { data, error } = await backend
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
      const { data: taskData } = await backend
        .from('tasks')
        .select('title, created_by, project_id')
        .eq('id', taskId)
        .single();

      if (taskData && taskData.created_by && taskData.created_by !== user.id) {
        await backend.from('notifications').insert({
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
