import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import type { RecurringTask } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseRecurringTasksOptions {
  workspaceId?: string | null;
}

export function useRecurringTasks(options: UseRecurringTasksOptions = {}) {
  const { user, isManager } = useAuth();
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurringTasks = useCallback(async () => {
    if (!options.workspaceId) {
      setRecurringTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await backend
        .from('recurring_tasks')
        .select('*')
        .eq('workspace_id', options.workspaceId)
        .eq('active', true)
        .order('next_run_at', { ascending: true });

      if (error) throw error;
      setRecurringTasks((data || []) as RecurringTask[]);
    } catch (error) {
      console.error('Failed to fetch recurring tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [options.workspaceId]);

  useEffect(() => {
    fetchRecurringTasks();
  }, [fetchRecurringTasks]);

  const createRecurringTask = async (
    payload: Omit<RecurringTask, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'last_run_at'>
  ) => {
    if (!user || !isManager) {
      return { error: new Error('Only Manager/Admin can create recurring tasks') };
    }

    const { data, error } = await backend
      .from('recurring_tasks')
      .insert({
        ...payload,
        created_by: user.id,
        last_run_at: null,
      })
      .select()
      .single();

    if (!error && data) {
      setRecurringTasks((prev) => [...prev, data as RecurringTask]);
    }

    return { data, error };
  };

  return {
    recurringTasks,
    loading,
    fetchRecurringTasks,
    createRecurringTask,
  };
}
