import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import type { TaskTemplate, Task } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseTaskTemplatesOptions {
  workspaceId?: string | null;
}

export function useTaskTemplates(options: UseTaskTemplatesOptions = {}) {
  const { user, isManager } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!options.workspaceId) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await backend
        .from('task_templates')
        .select('*')
        .eq('workspace_id', options.workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as TaskTemplate[]);
    } catch (err: any) {
      console.error('Failed to fetch task templates:', err);
      setError(err.message || 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [options.workspaceId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (
    payload: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ) => {
    if (!user || !isManager) {
      return { error: new Error('Only Manager/Admin can create templates') };
    }

    const { data, error } = await backend
      .from('task_templates')
      .insert({ ...payload, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      setTemplates((prev) => [data as TaskTemplate, ...prev]);
    }

    return { data, error };
  };

  const deleteTemplate = async (templateId: string) => {
    if (!user || !isManager) {
      return { error: new Error('Only Manager/Admin can delete templates') };
    }

    const { error } = await backend.from('task_templates').delete().eq('id', templateId);
    if (!error) {
      setTemplates((prev) => prev.filter((template) => template.id !== templateId));
    }
    return { error };
  };

  const instantiateTemplate = async (
    template: TaskTemplate,
    taskOverrides: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by'>> = {}
  ) => {
    if (!user || !isManager) {
      return { error: new Error('Only Manager/Admin can create tasks from template') };
    }

    const payload = {
      title: taskOverrides.title || template.title,
      description: taskOverrides.description ?? template.description,
      requirements: taskOverrides.requirements ?? template.requirements,
      deliverables: taskOverrides.deliverables ?? template.deliverables,
      status: taskOverrides.status || 'open',
      priority: taskOverrides.priority || template.priority,
      difficulty: taskOverrides.difficulty ?? template.difficulty,
      estimated_hours: taskOverrides.estimated_hours ?? template.estimated_hours,
      deadline: taskOverrides.deadline ?? null,
      skills: taskOverrides.skills ?? template.skills,
      assigned_to: taskOverrides.assigned_to ?? null,
      project_id: taskOverrides.project_id ?? template.project_id,
      workspace_id: taskOverrides.workspace_id ?? template.workspace_id,
      created_by: user.id,
    };

    return backend.from('tasks').insert(payload).select().single();
  };

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    instantiateTemplate,
  };
}
