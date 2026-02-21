import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/integrations/backend/client';
import type { Document } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface UseDocumentsOptions {
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}

interface UploadDocumentInput {
  file: File;
  title: string;
  description?: string;
  type?: string;
  status?: Document['status'];
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const { user, isManager } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      let query = backend.from('documents').select('*').order('updated_at', { ascending: false });
      if (options.workspaceId) query = query.eq('workspace_id', options.workspaceId);
      if (options.projectId) query = query.eq('project_id', options.projectId);
      if (options.taskId) query = query.eq('task_id', options.taskId);

      const { data, error } = await query;
      if (error) throw error;
      setDocuments((data || []) as Document[]);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [options.workspaceId, options.projectId, options.taskId]);

  useEffect(() => {
    fetchDocuments();

    const channel = backend
      .channel('documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => fetchDocuments())
      .subscribe();

    return () => backend.removeChannel(channel);
  }, [fetchDocuments]);

  const uploadDocument = async (input: UploadDocumentInput) => {
    if (!user) return { error: new Error('Not authenticated') };

    const safeName = `${Date.now()}-${input.file.name}`;
    const uploadResult = await backend.storage.from('task-attachments').upload(`documents/${safeName}`, input.file, {
      upsert: false,
    });

    if (uploadResult.error) {
      return { error: uploadResult.error };
    }

    const {
      data: { publicUrl },
    } = backend.storage.from('task-attachments').getPublicUrl(`documents/${safeName}`);

    const { data: previousVersions } = await backend
      .from('documents')
      .select('version')
      .eq('title', input.title)
      .eq('workspace_id', input.workspaceId || options.workspaceId || null)
      .order('version', { ascending: false })
      .limit(1);

    const latestVersion = Number((previousVersions as Array<{ version?: number }> | undefined)?.[0]?.version || 0);

    const { data, error } = await backend
      .from('documents')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type || input.file.type || 'application/octet-stream',
        file_url: publicUrl,
        file_size: input.file.size,
        status: input.status || 'active',
        version: latestVersion + 1,
        parent_document_id: null,
        workspace_id: input.workspaceId || options.workspaceId || null,
        project_id: input.projectId || options.projectId || null,
        task_id: input.taskId || options.taskId || null,
        created_by: user.id,
        owner_id: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setDocuments((prev) => [data as Document, ...prev]);
    }

    return { data, error };
  };

  const deleteDocument = async (document: Document) => {
    if (!user) return { error: new Error('Not authenticated') };
    if (!isManager && document.owner_id !== user.id) {
      return { error: new Error('Only owner, manager, or admin can delete this document') };
    }

    const { error } = await backend.from('documents').delete().eq('id', document.id);
    if (!error) {
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    }

    return { error };
  };

  return {
    documents,
    loading,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  };
}
