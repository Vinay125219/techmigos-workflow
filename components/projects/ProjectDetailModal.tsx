import { useRouter } from 'next/navigation';
import { Calendar, Clock, Users, FolderKanban, Target, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { Project } from '@/types/database';
import { format } from 'date-fns';

interface ProjectDetailModalProps {
    project: Project | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProjectDetailModal({ project, open, onOpenChange }: ProjectDetailModalProps) {
    const router = useRouter();

    if (!project) return null;

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

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Not set';
        return format(new Date(dateStr), 'MMM d, yyyy');
    };

    const taskCount = project.task_count || 0;
    const completedTasks = project.completed_tasks || 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl" aria-describedby="project-detail-description">
                <DialogHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-xl">{project.name}</DialogTitle>
                            {project.category && (
                                <Badge variant="outline" className="text-xs">{project.category}</Badge>
                            )}
                        </div>
                        {getStatusBadge(project.status)}
                    </div>
                    <DialogDescription id="project-detail-description" className="sr-only">
                        Project details and information
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Description */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="text-sm text-muted-foreground">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    <Separator />

                    {/* Progress */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Progress</h4>
                            <span className="text-sm font-bold">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <Target className="w-4 h-4" />
                                {completedTasks} of {taskCount} tasks completed
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Timeline */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                Start Date
                            </div>
                            <p className="font-medium text-sm">{formatDate(project.start_date)}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                End Date
                            </div>
                            <p className="font-medium text-sm">{formatDate(project.end_date)}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            className="flex-1"
                            onClick={() => {
                                router.push(`/tasks?project=${project.id}`);
                                onOpenChange(false);
                            }}
                        >
                            <FolderKanban className="w-4 h-4 mr-2" />
                            View Tasks ({taskCount})
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                router.push(`/projects?highlight=${project.id}`);
                                onOpenChange(false);
                            }}
                        >
                            Go to Projects
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
