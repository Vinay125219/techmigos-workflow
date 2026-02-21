import { useMemo } from 'react';
import { addHours, differenceInDays, format } from 'date-fns';
import { backend } from '@/integrations/backend/client';
import { useTasks } from '@/hooks/useTasks';
import type { Task } from '@/types/database';
import { useEffect, useState } from 'react';

interface TaskDependencyRow {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: 'blocks' | 'related';
}

export function useDependencyPlanning(workspaceId?: string | null) {
  const { tasks } = useTasks({ workspaceId });
  const [dependencies, setDependencies] = useState<TaskDependencyRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      let query = backend.from('task_dependencies').select('*');
      if (workspaceId) {
        const { data: workspaceTasks } = await backend
          .from('tasks')
          .select('id')
          .eq('workspace_id', workspaceId);

        const taskIds = ((workspaceTasks || []) as Array<{ id: string }>).map((task) => task.id);
        if (taskIds.length === 0) {
          if (mounted) setDependencies([]);
          return;
        }

        query = query.in('task_id', taskIds);
      }

      const { data } = await query;
      if (mounted) {
        setDependencies((data || []) as TaskDependencyRow[]);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const blockedAlerts = useMemo(() => {
    return dependencies
      .filter((dependency) => dependency.dependency_type === 'blocks')
      .filter((dependency) => {
        const blocker = taskMap.get(dependency.depends_on_task_id);
        return blocker && blocker.status !== 'completed';
      })
      .map((dependency) => {
        const task = taskMap.get(dependency.task_id);
        const blocker = taskMap.get(dependency.depends_on_task_id);
        return {
          dependencyId: dependency.id,
          task,
          blocker,
        };
      })
      .filter((entry) => entry.task && entry.blocker);
  }, [dependencies, taskMap]);

  const criticalPath = useMemo(() => {
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();

    tasks.forEach((task) => {
      incoming.set(task.id, []);
      outgoing.set(task.id, []);
    });

    dependencies
      .filter((dependency) => dependency.dependency_type === 'blocks')
      .forEach((dependency) => {
        if (!incoming.has(dependency.task_id) || !outgoing.has(dependency.depends_on_task_id)) return;
        incoming.get(dependency.task_id)!.push(dependency.depends_on_task_id);
        outgoing.get(dependency.depends_on_task_id)!.push(dependency.task_id);
      });

    const roots = tasks.filter((task) => (incoming.get(task.id) || []).length === 0).map((task) => task.id);
    const distance = new Map<string, number>();
    const parent = new Map<string, string | null>();

    tasks.forEach((task) => {
      distance.set(task.id, Number.NEGATIVE_INFINITY);
      parent.set(task.id, null);
    });

    roots.forEach((root) => distance.set(root, taskMap.get(root)?.estimated_hours || 1));

    const queue = [...roots];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDistance = distance.get(current) || 0;
      (outgoing.get(current) || []).forEach((next) => {
        const weight = taskMap.get(next)?.estimated_hours || 1;
        if (currentDistance + weight > (distance.get(next) || Number.NEGATIVE_INFINITY)) {
          distance.set(next, currentDistance + weight);
          parent.set(next, current);
        }
        queue.push(next);
      });
    }

    const endNode = tasks.reduce((best, task) => {
      const current = distance.get(task.id) || Number.NEGATIVE_INFINITY;
      const bestDistance = best ? distance.get(best) || Number.NEGATIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return current > bestDistance ? task.id : best;
    }, '' as string);

    const path: Task[] = [];
    let cursor: string | null = endNode || null;
    while (cursor) {
      const task = taskMap.get(cursor);
      if (task) path.unshift(task);
      cursor = parent.get(cursor) || null;
    }

    return path;
  }, [dependencies, tasks, taskMap]);

  const ganttRows = useMemo(() => {
    return tasks.map((task) => {
      const start = new Date(task.created_at);
      const end = task.deadline ? new Date(task.deadline) : addHours(start, Math.max(1, task.estimated_hours || 24));
      const durationDays = Math.max(1, differenceInDays(end, start) || 1);

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        startLabel: format(start, 'MMM d'),
        endLabel: format(end, 'MMM d'),
        durationDays,
      };
    });
  }, [tasks]);

  return {
    dependencies,
    blockedAlerts,
    criticalPath,
    ganttRows,
  };
}
