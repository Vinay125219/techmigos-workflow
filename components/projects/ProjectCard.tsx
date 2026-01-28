import { useState } from 'react';
import { Calendar, CheckCircle2, Circle, Clock, AlertCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Project } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { EditProjectModal } from './EditProjectModal';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/hooks/use-toast';
import { ProjectDetailModal } from './ProjectDetailModal';

interface ProjectCardProps {
  project: Project;
  variant?: 'grid' | 'list';
  onViewTasks?: (projectId: string) => void;
}

export function ProjectCard({ project, variant = 'grid', onViewTasks }: ProjectCardProps) {
  const { user } = useAuth();
  const { deleteProject } = useProjects();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Only the creator can edit or delete the project
  const isCreator = user?.id === project.created_by;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteProject(project.id);
    setDeleting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Project deleted successfully' });
      setDeleteOpen(false);
    }
  };

  const getStatusBadge = (status: Project['status']) => {
    const styles = {
      planned: 'bg-secondary text-secondary-foreground',
      active: 'bg-accent text-accent-foreground',
      completed: 'bg-success text-success-foreground',
      'on-hold': 'bg-warning text-warning-foreground',
    };
    const labels = {
      planned: 'Planned',
      active: 'Active',
      completed: 'Completed',
      'on-hold': 'On Hold',
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const getHealthIndicator = (progress: number, status: Project['status']) => {
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (progress >= 70) return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (progress >= 30) return <AlertCircle className="w-4 h-4 text-warning" />;
    return <Circle className="w-4 h-4 text-muted-foreground" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const taskCount = project.task_count || 0;
  const completedTasks = project.completed_tasks || 0;

  // Action menu only visible to the project creator
  const ActionMenu = () => isCreator ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (variant === 'list') {
    return (
      <>
        <Card data-entity-id={project.id} className="card-hover">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold truncate">{project.name}</h3>
                  {getStatusBadge(project.status)}
                  {getHealthIndicator(project.progress, project.status)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{project.description || 'No description'}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 lg:gap-6 text-sm">
                {project.category && <Badge variant="outline">{project.category}</Badge>}

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                </div>

                <div className="w-32">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>

                <div className="text-muted-foreground">
                  {completedTasks}/{taskCount} tasks
                </div>

                <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
                  View Details
                </Button>
                <Button variant="outline" size="sm" onClick={() => onViewTasks?.(project.id)}>
                  View Tasks
                </Button>
                <ActionMenu />
              </div>
            </div>
          </CardContent>
        </Card>
        <EditProjectModal project={project} open={editOpen} onOpenChange={setEditOpen} />
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onConfirm={handleDelete}
          loading={deleting}
          title="Delete Project?"
          description={`This will permanently delete "${project.name}" and all its tasks. This action cannot be undone.`}
        />
        <ProjectDetailModal project={project} open={detailOpen} onOpenChange={setDetailOpen} />
      </>
    );
  }

  return (
    <>
      <Card data-entity-id={project.id} className="card-hover h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold leading-tight line-clamp-2">{project.name}</h3>
              {project.category && <Badge variant="outline" className="text-xs">{project.category}</Badge>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {getHealthIndicator(project.progress, project.status)}
              {getStatusBadge(project.status)}
              <ActionMenu />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description || 'No description'}</p>

          <div className="mt-auto space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{project.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${project.progress}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{completedTasks}/{taskCount} tasks</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
                View Details
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onViewTasks?.(project.id)}>
                View Tasks →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <EditProjectModal project={project} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Project?"
        description={`This will permanently delete "${project.name}" and all its tasks. This action cannot be undone.`}
      />
      <ProjectDetailModal project={project} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
