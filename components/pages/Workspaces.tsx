import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, FolderKanban, Settings, Trash2 } from 'lucide-react';
import { CreateWorkspaceModal } from '@/components/workspaces/CreateWorkspaceModal';
import { WorkspaceDetailModal } from '@/components/workspaces/WorkspaceDetailModal';
import type { Workspace } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Workspaces = () => {
  const { workspaces, loading, deleteWorkspace } = useWorkspaces();
  const { isAuthenticated, user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Workspace | null>(null);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    const { error } = await deleteWorkspace(deleteConfirm.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Workspace Deleted', description: 'Workspace has been removed.' });
    }
    setDeleteConfirm(null);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="text-muted-foreground">Please sign in to access workspaces.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Workspaces</h1>
            <p className="text-muted-foreground">Organize your projects and tasks into collaborative spaces</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Workspace
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-3/4 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Workspaces Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first workspace to organize projects and collaborate with your team.</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map(workspace => (
              <Card key={workspace.id} className="card-hover cursor-pointer" onClick={() => setSelectedWorkspace(workspace)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{workspace.name}</CardTitle>
                      <CardDescription className="line-clamp-2">{workspace.description || 'No description'}</CardDescription>
                    </div>
                    {workspace.owner_id === user?.id && (
                      <Badge variant="secondary">Owner</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{workspace.member_count || 0} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FolderKanban className="w-4 h-4" />
                      <span>{workspace.project_count || 0} projects</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelectedWorkspace(workspace); }}>
                      <Settings className="w-4 h-4 mr-1" />
                      Manage
                    </Button>
                    {workspace.owner_id === user?.id && (
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(workspace); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceModal open={showCreate} onOpenChange={setShowCreate} />
      
      <WorkspaceDetailModal 
        workspace={selectedWorkspace} 
        open={!!selectedWorkspace} 
        onOpenChange={(open) => !open && setSelectedWorkspace(null)} 
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteConfirm?.name}" and remove all member associations. Projects in this workspace will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default Workspaces;
