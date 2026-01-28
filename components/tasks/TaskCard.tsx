"use client";
import { useState } from 'react';
import { Clock, AlertTriangle, Sparkles, Pencil, Trash2, ArrowRight, User, AlertCircle, BarChart, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { EditTaskModal } from './EditTaskModal';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface TaskCardProps {
  task: Task;
  onTakeTask?: (taskId: string) => void;
  onViewDetails?: (task: Task) => void;
  viewMode?: 'grid' | 'board';
}

export function TaskCard({ task, onTakeTask, onViewDetails, viewMode = 'grid' }: TaskCardProps) {
  const { user } = useAuth();
  const { deleteTask } = useTasks();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCreator = user?.id === task.created_by;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteTask(task.id);
    setDeleting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Task deleted successfully' });
      setDeleteOpen(false);
    }
  };

  const getPriorityStyles = (priority: Task['priority']) => {
    const styles = {
      low: 'bg-secondary/50 text-secondary-foreground border-secondary',
      medium: 'bg-gradient-to-r from-info/20 to-info/10 text-info border-info/40',
      high: 'bg-gradient-to-r from-warning/20 to-warning/10 text-warning border-warning/40',
      critical: 'bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/40 animate-pulse',
    };
    return styles[priority];
  };

  const getCardBorderStyle = (priority: Task['priority'], status: Task['status']) => {
    if (status === 'completed') return 'border-success/40 bg-gradient-to-br from-success/5 to-transparent';
    if (priority === 'critical') return 'border-destructive/50 bg-gradient-to-br from-destructive/5 to-transparent';
    if (priority === 'high') return 'border-warning/40 bg-gradient-to-br from-warning/5 to-transparent';
    return '';
  };

  const getDifficultyBadge = (difficulty: Task['difficulty']) => {
    if (!difficulty) return null;
    const labels = { easy: '⚡ Easy', medium: '💪 Medium', hard: '🔥 Hard', expert: '👑 Expert' };
    const colors = {
      easy: 'bg-gradient-to-r from-success/20 to-success/10 text-success border-success/30',
      medium: 'bg-gradient-to-r from-info/20 to-info/10 text-info border-info/30',
      hard: 'bg-gradient-to-r from-warning/20 to-warning/10 text-warning border-warning/30',
      expert: 'bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/30',
    };
    return <Badge className={cn("text-xs border", colors[difficulty])}>{labels[difficulty]}</Badge>;
  };

  const getStatusBadge = (status: Task['status']) => {
    const styles = {
      'open': 'bg-gradient-to-r from-accent/90 to-accent text-white shadow-sm shadow-accent/30',
      'in-progress': 'bg-gradient-to-r from-info/90 to-info text-white shadow-sm shadow-info/30',
      'review': 'bg-gradient-to-r from-warning/90 to-warning text-white shadow-sm shadow-warning/30',
      'completed': 'bg-gradient-to-r from-success/90 to-success text-white shadow-sm shadow-success/30',
    };
    const labels = {
      'open': '✨ Available',
      'in-progress': '⏳ In Progress',
      'review': '👀 In Review',
      'completed': '✅ Completed',
    };
    return <Badge className={cn("text-xs font-medium", styles[status])}>{labels[status]}</Badge>;
  };

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return { text: 'No deadline', isUrgent: false };
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: '🚨 Overdue', isUrgent: true };
    if (diffDays === 0) return { text: '⚠️ Due today', isUrgent: true };
    if (diffDays <= 3) return { text: `⏰ ${diffDays} days left`, isUrgent: true };
    return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isUrgent: false };
  };

  const deadline = formatDeadline(task.deadline);
  const canTake = task.status === 'open';
  const isOverdue = deadline.isUrgent && task.deadline && new Date(task.deadline) < new Date();
  const skills = task.skills || [];

  // Always visible action buttons for creator with colorful styling
  const CreatorActions = () => isCreator ? (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 text-blue-500 hover:text-blue-600 transition-all duration-200 hover:scale-110 shadow-sm"
        onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
        title="Edit Task"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full bg-gradient-to-r from-rose-500/10 to-pink-500/10 hover:from-rose-500/20 hover:to-pink-500/20 text-rose-500 hover:text-rose-600 transition-all duration-200 hover:scale-110 shadow-sm"
        onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
        title="Delete Task"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  ) : null;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        transition={{ duration: 0.3 }}
        className="h-full"
      >
        <Card
          data-entity-id={task.id}
          className={cn(
            "relative overflow-hidden flex flex-col h-full transition-all duration-300",
            "hover:shadow-xl hover:border-accent/50 group border-l-4",
            getCardBorderStyle(task.priority, task.status)
          )}>

          {/* Decorative gradient overlay */}
          {canTake && (
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          )}

          <CardHeader className="pb-2 relative z-10">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap gap-2 mb-1">
                  {getStatusBadge(task.status)}
                  {isOverdue && task.status !== 'completed' && (
                    <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                  {task.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {task.project?.name || 'Independent Task'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-col items-end">
                <CreatorActions />
                {getDifficultyBadge(task.difficulty)}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col relative z-10 pt-0">
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {task.description || 'No description provided'}
            </p>

            {/* Skills tags with gradient borders */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {skills.slice(0, 3).map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="text-xs bg-gradient-to-r from-secondary/50 to-secondary/30 hover:from-accent/20 hover:to-accent/10 transition-colors"
                  >
                    {skill}
                  </Badge>
                ))}
                {skills.length > 3 && (
                  <Badge variant="outline" className="text-xs bg-secondary/30">
                    +{skills.length - 3} more
                  </Badge>
                )}
              </div>
            )}

            <div className="mt-auto space-y-2.5">
              {/* Meta info row */}
              <div className="flex items-center flex-wrap gap-2 text-sm">
                {task.estimated_hours && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/50 text-xs">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{task.estimated_hours}h</span>
                  </div>
                )}
                <Badge className={cn("text-xs border", getPriorityStyles(task.priority))}>
                  {task.priority === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </Badge>
              </div>

              {/* Deadline */}
              <div className={cn(
                "flex items-center gap-1.5 text-xs",
                deadline.isUrgent ? "text-destructive font-semibold" : "text-muted-foreground"
              )}>
                <span>{deadline.text}</span>
              </div>

              {/* Assignee */}
              {task.assignee ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="w-5 h-5 border">
                    <AvatarImage src={task.assignee.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px]">{task.assignee.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{task.assignee.full_name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                  <User className="w-3 h-3" /> Unassigned
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs hover:bg-secondary/80"
                  onClick={() => onViewDetails?.(task)}
                >
                  View Details
                </Button>
                {canTake && (
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent shadow-sm shadow-accent/25"
                    onClick={() => onTakeTask?.(task.id)}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Take Task
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      <EditTaskModal task={task} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task?"
        description={`This will permanently delete "${task.title}". This action cannot be undone.`}
      />
    </>
  );
}
