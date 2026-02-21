import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface TaskApprovalItem {
  id: string;
  task_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  required_approvals: number;
  approval_count: number;
  due_at: string;
  created_at: string;
}

export function useTaskApprovals() {
  const { activeWorkspaceId } = useWorkspaceContext();
  const [approvals, setApprovals] = useState<TaskApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    if (!activeWorkspaceId) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await backend
        .from('task_approvals')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false });

      setApprovals((data || []) as TaskApprovalItem[]);
    } catch (error) {
      console.error('Failed to fetch task approvals:', error);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  return {
    approvals,
    loading,
    fetchApprovals,
  };
}
