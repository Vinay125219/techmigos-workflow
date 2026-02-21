"use client";

import { useMemo } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId, loading } = useWorkspaceContext();

  const label = useMemo(() => {
    if (loading) return 'Loading workspace...';
    if (activeWorkspace) return activeWorkspace.name;
    return 'Select workspace';
  }, [loading, activeWorkspace]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 max-w-[220px] justify-between gap-2">
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        {workspaces.length === 0 ? (
          <DropdownMenuItem onClick={() => router.push('/workspaces')}>
            Create your first workspace
          </DropdownMenuItem>
        ) : (
          workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => setActiveWorkspaceId(workspace.id)}
              className={workspace.id === activeWorkspaceId ? 'bg-accent/20' : ''}
            >
              {workspace.name}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem onClick={() => router.push('/workspaces')}>Manage workspaces</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
