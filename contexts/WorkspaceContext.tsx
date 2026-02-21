"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Workspace } from '@/types/database';
import { useWorkspaces } from '@/hooks/useWorkspaces';

const STORAGE_KEY = 'tm_active_workspace_id';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  loading: boolean;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { workspaces, loading, fetchWorkspaces } = useWorkspaces();
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = window.localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      setActiveWorkspaceIdState(persisted);
    }
  }, []);

  useEffect(() => {
    if (!workspaces.length) {
      setActiveWorkspaceIdState(null);
      return;
    }

    const exists = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (!exists) {
      setActiveWorkspaceIdState(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  const setActiveWorkspaceId = (workspaceId: string | null) => {
    setActiveWorkspaceIdState(workspaceId);
    if (typeof window !== 'undefined') {
      if (workspaceId) {
        window.localStorage.setItem(STORAGE_KEY, workspaceId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  const value = useMemo<WorkspaceContextType>(
    () => ({
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      loading,
      setActiveWorkspaceId,
      refreshWorkspaces: fetchWorkspaces,
    }),
    [workspaces, activeWorkspaceId, activeWorkspace, loading, fetchWorkspaces]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return context;
}
