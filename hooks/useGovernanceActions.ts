import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import type { GovernanceAction } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useGovernanceActions() {
  const { user, isAdmin } = useAuth();
  const [actions, setActions] = useState<GovernanceAction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    if (!isAdmin) {
      setActions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await backend
        .from('governance_actions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions((data || []) as GovernanceAction[]);
    } catch (error) {
      console.error('Failed to fetch governance actions:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const approveAction = async (action: GovernanceAction) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized') };

    if (action.action_type === 'delete_project' && action.entity_id) {
      const { error: deleteError } = await backend.from('projects').delete().eq('id', action.entity_id);
      if (deleteError) return { error: deleteError };
    }

    const { error } = await backend
      .from('governance_actions')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', action.id);

    if (!error) fetchActions();
    return { error };
  };

  const rejectAction = async (actionId: string) => {
    if (!user || !isAdmin) return { error: new Error('Not authorized') };

    const { error } = await backend
      .from('governance_actions')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (!error) fetchActions();
    return { error };
  };

  return {
    actions,
    loading,
    fetchActions,
    approveAction,
    rejectAction,
  };
}
