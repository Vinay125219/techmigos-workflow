import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import type { CompanyTransaction } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseCompanyTransactionsOptions {
  workspaceId?: string | null;
  page?: number;
  pageSize?: number;
  search?: string;
  transactionType?: CompanyTransaction['transaction_type'] | 'all';
  settlementStatus?: CompanyTransaction['settlement_status'] | 'all';
  projectId?: string | 'all';
}

export function useCompanyTransactions(options: UseCompanyTransactionsOptions = {}) {
  const { user, isManager, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<CompanyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isCollectionMissing, setIsCollectionMissing] = useState(false);

  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, options.pageSize || 20);
  const offset = (page - 1) * pageSize;

  const isMissingCollectionError = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    const typed = value as { message?: string; status?: number; code?: number; type?: string };
    const message = typed.message?.toLowerCase() || '';
    const type = typed.type?.toLowerCase() || '';

    return (
      typed.status === 404 ||
      typed.code === 404 ||
      type.includes('collection_not_found') ||
      message.includes('collection with the requested id') ||
      message.includes('could not be found')
    );
  };

  const fetchTransactions = useCallback(async () => {
    if (!isManager) {
      setTransactions([]);
      setTotalCount(0);
      setLoading(false);
      setError(null);
      setIsCollectionMissing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let query = backend
        .from('company_transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      if (options.workspaceId) {
        query = query.eq('workspace_id', options.workspaceId);
      }

      if (options.projectId && options.projectId !== 'all') {
        query = options.projectId === 'none'
          ? query.eq('project_id', null)
          : query.eq('project_id', options.projectId);
      }

      if (options.transactionType && options.transactionType !== 'all') {
        query = query.eq('transaction_type', options.transactionType);
      }

      if (options.settlementStatus && options.settlementStatus !== 'all') {
        query = query.eq('settlement_status', options.settlementStatus);
      }

      if (options.search && options.search.trim()) {
        query = query.search('title', options.search.trim());
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      setTransactions((data || []) as CompanyTransaction[]);
      setTotalCount(count || 0);
      setIsCollectionMissing(false);
    } catch (err: unknown) {
      if (isMissingCollectionError(err)) {
        setTransactions([]);
        setTotalCount(0);
        setIsCollectionMissing(true);
        setError(
          'Company transactions collection is not configured in Appwrite. Create `company_transactions` and reload.'
        );
        return;
      }

      console.error('Failed to fetch company transactions:', err);
      const message = err instanceof Error ? err.message : 'Failed to fetch company transactions';
      setError(message);
      setIsCollectionMissing(false);
    } finally {
      setLoading(false);
    }
  }, [
    isManager,
    options.workspaceId,
    options.projectId,
    options.transactionType,
    options.settlementStatus,
    options.search,
    offset,
    pageSize,
  ]);

  useEffect(() => {
    fetchTransactions();

    const channel = backend
      .channel('company-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      backend.removeChannel(channel);
    };
  }, [fetchTransactions]);

  const createTransaction = async (
    payload: Omit<CompanyTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by'>
  ) => {
    if (!user || !isManager) {
      return { error: new Error('Only Admin/Manager can create transactions') };
    }

    if (isCollectionMissing) {
      return { error: new Error('Company transactions collection is not configured.') };
    }

    const { data, error } = await backend
      .from('company_transactions')
      .insert({ ...payload, created_by: user.id })
      .select()
      .single();

    if (!error && data) {
      setTransactions((prev) => [data as CompanyTransaction, ...prev]);
    }

    return { data, error };
  };

  const updateTransaction = async (id: string, updates: Partial<CompanyTransaction>) => {
    if (!user || !isAdmin) {
      return { error: new Error('Only Admin can update transactions') };
    }

    if (isCollectionMissing) {
      return { error: new Error('Company transactions collection is not configured.') };
    }

    const { data, error } = await backend
      .from('company_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setTransactions((prev) => prev.map((tx) => (tx.id === id ? ({ ...tx, ...data } as CompanyTransaction) : tx)));
    }

    return { data, error };
  };

  const deleteTransaction = async (id: string) => {
    if (!user || !isAdmin) {
      return { error: new Error('Only Admin can delete transactions') };
    }

    if (isCollectionMissing) {
      return { error: new Error('Company transactions collection is not configured.') };
    }

    const { error } = await backend.from('company_transactions').delete().eq('id', id);

    if (!error) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    }

    return { error };
  };

  const fetchAllTransactions = async () => {
    if (!isManager) {
      return { data: [] as CompanyTransaction[], error: new Error('Only Admin/Manager can view transactions') };
    }

    try {
      let query = backend
        .from('company_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(5000);

      if (options.workspaceId) {
        query = query.eq('workspace_id', options.workspaceId);
      }

      if (options.projectId && options.projectId !== 'all') {
        query = options.projectId === 'none'
          ? query.eq('project_id', null)
          : query.eq('project_id', options.projectId);
      }

      if (options.transactionType && options.transactionType !== 'all') {
        query = query.eq('transaction_type', options.transactionType);
      }

      if (options.settlementStatus && options.settlementStatus !== 'all') {
        query = query.eq('settlement_status', options.settlementStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: (data || []) as CompanyTransaction[], error: null };
    } catch (err) {
      return {
        data: [] as CompanyTransaction[],
        error: err instanceof Error ? err : new Error('Failed to load transactions'),
      };
    }
  };

  return {
    transactions,
    loading,
    error,
    isCollectionMissing,
    totalCount,
    page,
    pageSize,
    hasMore: offset + transactions.length < totalCount,
    fetchTransactions,
    fetchAllTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
