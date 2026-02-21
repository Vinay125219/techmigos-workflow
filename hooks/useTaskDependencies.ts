import { useState, useCallback } from 'react';
import { backend } from '@/integrations/backend/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/types/database';

export interface TaskDependency {
    id: string;
    task_id: string;
    depends_on_task_id: string;
    dependency_type: 'blocks' | 'related';
    created_by: string;
    created_at: string;
    // Joined task details
    depends_on_task?: Task;
    task?: Task;
}

export function useTaskDependencies(taskId?: string) {
    const { user } = useAuth();
    const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
    const [blockingTasks, setBlockingTasks] = useState<TaskDependency[]>([]);
    const [blockedByTasks, setBlockedByTasks] = useState<TaskDependency[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch dependencies for a task
    const fetchDependencies = useCallback(async (tid: string) => {
        try {
            setLoading(true);

            // Get tasks that this task depends on (upstream)
            const { data: upstream, error: upstreamError } = await backend
                .from('task_dependencies')
                .select('*')
                .eq('task_id', tid);

            if (upstreamError) throw upstreamError;

            // Get tasks that depend on this task (downstream)
            const { data: downstream, error: downstreamError } = await backend
                .from('task_dependencies')
                .select('*')
                .eq('depends_on_task_id', tid);

            if (downstreamError) throw downstreamError;

            const upstreamDeps = (upstream || []) as unknown as TaskDependency[];
            const downstreamDeps = (downstream || []) as unknown as TaskDependency[];

            const taskIds = Array.from(new Set([
                ...upstreamDeps.map(dep => dep.depends_on_task_id),
                ...downstreamDeps.map(dep => dep.task_id),
            ]));

            const { data: tasks } = taskIds.length > 0
                ? await backend.from('tasks').select('*').in('id', taskIds)
                : { data: [] };

            const taskMap = new Map(
                ((tasks || []) as Array<{ id: string }>).map((task) => [task.id, task as unknown as Task])
            );

            const blocking = upstreamDeps.map(dep => ({
                ...dep,
                depends_on_task: taskMap.get(dep.depends_on_task_id),
            }));

            const blockedBy = downstreamDeps.map(dep => ({
                ...dep,
                task: taskMap.get(dep.task_id),
            }));

            setDependencies(blocking);
            setBlockingTasks(blocking);
            setBlockedByTasks(blockedBy);

        } catch (err) {
            console.error('Error fetching dependencies:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Add a dependency
    const addDependency = async (currentTaskId: string, dependsOnTaskId: string, type: 'blocks' | 'related' = 'blocks') => {
        if (!user) return { error: new Error('Not authenticated') };

        const { data, error } = await backend
            .from('task_dependencies')
            .insert({
                task_id: currentTaskId,
                depends_on_task_id: dependsOnTaskId,
                dependency_type: type,
                created_by: user.id
            })
            .select()
            .single();

        if (!error && taskId) {
            fetchDependencies(taskId);
        }

        return { data, error };
    };

    // Remove a dependency
    const removeDependency = async (dependencyId: string) => {
        const { error } = await backend
            .from('task_dependencies')
            .delete()
            .eq('id', dependencyId);

        if (!error && taskId) {
            fetchDependencies(taskId);
        }

        return { error };
    };

    return {
        dependencies,
        blockingTasks, // Tasks that prevent this one from finishing
        blockedByTasks, // Tasks waiting on this one
        loading,
        fetchDependencies,
        addDependency,
        removeDependency
    };
}
