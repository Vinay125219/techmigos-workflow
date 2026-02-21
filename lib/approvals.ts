import { addHours } from 'date-fns';
import { backend } from '@/integrations/backend/client';
import type { Task } from '@/types/database';

type ApprovalRuleRecord = {
  id: string;
  required_approvals: number;
  sla_hours: number;
};

type TaskApprovalRecord = {
  id: string;
  task_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  required_approvals: number;
  approval_count: number;
  due_at: string;
  comments?: string | null;
};

function normalizeIdSegment(value: string, maxLength: number): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (cleaned.length >= maxLength) return cleaned.slice(0, maxLength);
  return cleaned.padEnd(maxLength, '0');
}

function buildEscalationNotificationId(approvalId: string, userId: string): string {
  const approvalPart = normalizeIdSegment(approvalId, 14);
  const userPart = normalizeIdSegment(userId, 14);
  return `esc_${approvalPart}_${userPart}`.slice(0, 36);
}

function isDuplicateInsertError(error: Error | null | undefined): boolean {
  if (!error) return false;

  const status = (error as { status?: number }).status;
  if (status === 409) return true;

  return /already exists|duplicate/i.test(error.message || '');
}

async function resolveApprovalRule(task: Task): Promise<ApprovalRuleRecord | null> {
  if (!task.workspace_id) return null;

  const scopedRule = await backend
    .from('approval_rules')
    .select('*')
    .eq('workspace_id', task.workspace_id)
    .eq('project_id', task.project_id)
    .limit(1)
    .maybeSingle();

  if (scopedRule.data) return scopedRule.data as ApprovalRuleRecord;

  const workspaceDefaultRule = await backend
    .from('approval_rules')
    .select('*')
    .eq('workspace_id', task.workspace_id)
    .limit(1)
    .maybeSingle();

  return (workspaceDefaultRule.data as ApprovalRuleRecord | null) || null;
}

export async function createApprovalRequest(task: Task, requestedBy: string) {
  const rule = await resolveApprovalRule(task);
  const requiredApprovals = Math.max(1, rule?.required_approvals || 1);
  const slaHours = Math.max(1, rule?.sla_hours || 24);
  const dueAt = addHours(new Date(), slaHours).toISOString();

  const { data: existingRequest } = await backend
    .from('task_approvals')
    .select('*')
    .eq('task_id', task.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (existingRequest) {
    return { data: existingRequest, error: null };
  }

  return backend
    .from('task_approvals')
    .insert({
      task_id: task.id,
      workspace_id: task.workspace_id,
      status: 'pending',
      requested_by: requestedBy,
      requested_at: new Date().toISOString(),
      due_at: dueAt,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      required_approvals: requiredApprovals,
      approval_count: 0,
      comments: null,
    })
    .select()
    .single();
}

export async function approveTaskWithWorkflow(task: Task, approvedBy: string, comments?: string) {
  const { data: approval } = await backend
    .from('task_approvals')
    .select('*')
    .eq('task_id', task.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  const pendingApproval = approval as TaskApprovalRecord | null;
  if (!pendingApproval) {
    return { error: new Error('No pending approval found for this task.'), completed: false };
  }

  const nextCount = Math.min(
    pendingApproval.required_approvals,
    (pendingApproval.approval_count || 0) + 1
  );
  const completed = nextCount >= pendingApproval.required_approvals;

  const { error: approvalUpdateError } = await backend
    .from('task_approvals')
    .update({
      approval_count: nextCount,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      status: completed ? 'approved' : 'pending',
      comments: comments || pendingApproval.comments || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingApproval.id);

  if (approvalUpdateError) {
    return { error: approvalUpdateError, completed: false };
  }

  if (completed) {
    const { error: taskError } = await backend
      .from('tasks')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', task.id);

    if (taskError) {
      return { error: taskError, completed: false };
    }
  }

  return { error: null, completed };
}

export async function rejectTaskWithWorkflow(task: Task, rejectedBy: string, comments?: string) {
  const { data: approval } = await backend
    .from('task_approvals')
    .select('*')
    .eq('task_id', task.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  const pendingApproval = approval as TaskApprovalRecord | null;
  if (!pendingApproval) {
    return { error: new Error('No pending approval found for this task.') };
  }

  const { error: approvalError } = await backend
    .from('task_approvals')
    .update({
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: new Date().toISOString(),
      comments: comments || pendingApproval.comments || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingApproval.id);

  if (approvalError) return { error: approvalError };

  const { error: taskError } = await backend
    .from('tasks')
    .update({ status: 'in-progress', updated_at: new Date().toISOString() })
    .eq('id', task.id);

  return { error: taskError || null };
}

export async function runApprovalEscalations(workspaceId?: string | null) {
  if (!workspaceId) return;

  const nowIso = new Date().toISOString();
  const { data: workspaceMembers, error: workspaceMemberError } = await backend
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId);

  if (workspaceMemberError) {
    console.error('Failed to resolve workspace members for escalation:', workspaceMemberError);
    return;
  }

  const memberRows = (workspaceMembers || []) as Array<{ user_id: string; role: string }>;
  const workspaceMemberIds = Array.from(new Set(memberRows.map((row) => row.user_id)));
  const workspaceAdminIds = memberRows
    .filter((row) => row.role === 'owner' || row.role === 'admin')
    .map((row) => row.user_id);

  let managerRoleIds: string[] = [];
  if (workspaceMemberIds.length > 0) {
    const { data: managerRoles } = await backend
      .from('user_roles')
      .select('user_id')
      .in('user_id', workspaceMemberIds)
      .in('role', ['admin', 'manager']);

    managerRoleIds = ((managerRoles || []) as Array<{ user_id: string }>).map((role) => role.user_id);
  }

  const escalationRecipients = Array.from(new Set([...workspaceAdminIds, ...managerRoleIds]));
  if (escalationRecipients.length === 0) return;

  while (true) {
    const { data: overdueRows, error: overdueError } = await backend
      .from('task_approvals')
      .select('id, task_id, status, required_approvals, approval_count, due_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .lt('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(100);

    if (overdueError) {
      console.error('Failed to query overdue task approvals:', overdueError);
      return;
    }

    const overdue = (overdueRows || []) as TaskApprovalRecord[];
    if (overdue.length === 0) return;

    for (const row of overdue) {
      const { data: escalatedRow, error: escalateError } = await backend
        .from('task_approvals')
        .update({ status: 'escalated', updated_at: nowIso })
        .eq('id', row.id)
        .eq('status', 'pending')
        .lt('due_at', nowIso)
        .select('id, task_id')
        .maybeSingle();

      if (escalateError) {
        console.error(`Failed to escalate approval ${row.id}:`, escalateError);
        continue;
      }

      if (!escalatedRow) {
        // Another scheduler run already escalated this row.
        continue;
      }

      for (const userId of escalationRecipients) {
        const notificationId = buildEscalationNotificationId(row.id, userId);
        const { error: notificationError } = await backend.from('notifications').insert({
          id: notificationId,
          user_id: userId,
          type: 'approval_escalation',
          title: 'Approval SLA Escalated',
          message: 'A task approval exceeded SLA and needs immediate attention.',
          entity_type: 'task',
          entity_id: row.task_id,
        });

        if (notificationError && !isDuplicateInsertError(notificationError)) {
          console.error(`Failed to insert escalation notification ${notificationId}:`, notificationError);
        }
      }
    }

    if (overdue.length < 100) return;
  }
}
