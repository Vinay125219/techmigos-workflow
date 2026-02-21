import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { backend } from '@/integrations/backend/client';
import type { RecurringTask } from '@/types/database';

type RecurringTaskRow = Pick<
  RecurringTask,
  | 'id'
  | 'title'
  | 'description'
  | 'frequency'
  | 'interval_value'
  | 'next_run_at'
  | 'project_id'
  | 'workspace_id'
  | 'active'
  | 'created_by'
>;

type RunDueRecurringTasksSummary = {
  workspaceId: string;
  createdTasks: number;
  skippedTasks: number;
  failedTasks: number;
};

const RECURRING_BATCH_SIZE = 100;
const RECURRING_MAX_BATCHES = 25;

function computeNextRun(fromDate: Date, frequency: RecurringTask['frequency'], intervalValue: number): Date {
  const safeInterval = Math.max(1, intervalValue || 1);
  if (frequency === 'daily') return addDays(fromDate, safeInterval);
  if (frequency === 'weekly') return addWeeks(fromDate, safeInterval);
  return addMonths(fromDate, safeInterval);
}

function normalizeIdSegment(value: string, maxLength: number): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleaned.length >= maxLength) return cleaned.slice(0, maxLength);
  return cleaned.padEnd(maxLength, '0');
}

function buildMaterializedTaskId(recurringTaskId: string, scheduledAt: Date): string {
  const recurringPart = normalizeIdSegment(recurringTaskId, 20);
  const schedulePart = format(scheduledAt, 'yyyyMMddHHmm');
  return `rt_${recurringPart}_${schedulePart}`.slice(0, 36);
}

function isDuplicateInsertError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const status = (error as { status?: number }).status;
  if (status === 409) return true;

  return /already exists|duplicate/i.test(error.message || '');
}

function toValidDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function runDueRecurringTasksForWorkspace(
  workspaceId: string,
  now: Date = new Date()
): Promise<RunDueRecurringTasksSummary> {
  const summary: RunDueRecurringTasksSummary = {
    workspaceId,
    createdTasks: 0,
    skippedTasks: 0,
    failedTasks: 0,
  };

  if (!workspaceId) return summary;

  const nowIso = now.toISOString();
  let batches = 0;

  while (batches < RECURRING_MAX_BATCHES) {
    batches += 1;
    const { data: dueRows, error: dueError } = await backend
      .from('recurring_tasks')
      .select('id, title, description, frequency, interval_value, next_run_at, project_id, workspace_id, active, created_by')
      .eq('workspace_id', workspaceId)
      .eq('active', true)
      .lte('next_run_at', nowIso)
      .order('next_run_at', { ascending: true })
      .limit(RECURRING_BATCH_SIZE);

    if (dueError) {
      console.error(`Failed to fetch due recurring tasks for workspace ${workspaceId}:`, dueError);
      summary.failedTasks += 1;
      return summary;
    }

    const dueTasks = (dueRows || []) as RecurringTaskRow[];
    if (dueTasks.length === 0) return summary;

    for (const recurringTask of dueTasks) {
      const scheduledAt = toValidDate(recurringTask.next_run_at);
      if (!scheduledAt) {
        summary.failedTasks += 1;
        continue;
      }

      const materializedTaskId = buildMaterializedTaskId(recurringTask.id, scheduledAt);
      const { error: taskInsertError } = await backend.from('tasks').insert({
        id: materializedTaskId,
        title: recurringTask.title,
        description: recurringTask.description,
        status: 'open',
        priority: 'medium',
        difficulty: null,
        estimated_hours: null,
        deadline: null,
        requirements: null,
        deliverables: null,
        skills: [],
        assigned_to: null,
        project_id: recurringTask.project_id,
        workspace_id: recurringTask.workspace_id,
        created_by: recurringTask.created_by || null,
      });

      if (taskInsertError && !isDuplicateInsertError(taskInsertError)) {
        console.error(
          `Failed to materialize recurring task ${recurringTask.id} for workspace ${workspaceId}:`,
          taskInsertError
        );
        summary.failedTasks += 1;
        continue;
      }

      if (taskInsertError && isDuplicateInsertError(taskInsertError)) {
        summary.skippedTasks += 1;
      } else {
        summary.createdTasks += 1;
      }

      const nextRun = computeNextRun(
        scheduledAt,
        recurringTask.frequency,
        recurringTask.interval_value || 1
      );

      const { error: recurringUpdateError } = await backend
        .from('recurring_tasks')
        .update({
          last_run_at: scheduledAt.toISOString(),
          next_run_at: nextRun.toISOString(),
        })
        .eq('id', recurringTask.id)
        .eq('workspace_id', workspaceId)
        .eq('next_run_at', recurringTask.next_run_at)
        .lte('next_run_at', nowIso);

      if (recurringUpdateError) {
        console.error(
          `Failed to advance recurring schedule ${recurringTask.id} for workspace ${workspaceId}:`,
          recurringUpdateError
        );
        summary.failedTasks += 1;
      }
    }

    if (dueTasks.length < RECURRING_BATCH_SIZE) return summary;
  }

  return summary;
}
