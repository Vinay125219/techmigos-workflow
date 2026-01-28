"use client";
import {
  Clock,
  Calendar,
  Target,
  CheckCircle2,
  Circle,
  ArrowRight,
  User,
  MessageSquare,
  Plus,
  Paperclip,
  FileImage,
  FileText,
  X,
  Loader2,
  Pencil,
  Trash2,
  UserPlus // Add UserPlus
} from 'lucide-react';
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Add Select components
import { cn } from '@/lib/utils';
import type { Task } from '@/types/database';
import { useTaskProgress, useTasks } from '@/hooks/useTasks';
import { useTeamMembers } from '@/hooks/useTeamMembers'; // Add this
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { TaskDiscussions } from './TaskDiscussions';
import { TaskDependencies } from './TaskDependencies';
import { EditTaskModal } from './EditTaskModal';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { RichTextViewer } from '@/components/ui/rich-text-editor';

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTakeTask?: (taskId: string) => void;
}

import { usePresence } from '@/hooks/usePresence';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function TaskDetailModal({ task, open, onOpenChange, onTakeTask }: TaskDetailModalProps) {
  const { isAuthenticated, user, isManager } = useAuth();
  const { deleteTask, submitTask, approveTask, rejectTask, assignTask } = useTasks();
  const { members: teamMembers } = useTeamMembers();
  const onlineUsers = usePresence(task ? `task-${task.id}` : '');
  const { progress, addProgress, uploading } = useTaskProgress(task?.id);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressContent, setProgressContent] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [progressPercentage, setProgressPercentage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'text-muted-foreground',
      medium: 'text-foreground',
      high: 'text-warning',
      critical: 'text-destructive',
    };
    return colors[priority] || 'text-muted-foreground';
  };

  if (!task) return null;

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
      onOpenChange(false);
    }
  };

  const getStatusStyles = (status: Task['status']) => {
    const styles = {
      'open': 'bg-secondary text-secondary-foreground',
      'in-progress': 'bg-accent text-accent-foreground',
      'review': 'bg-warning text-warning-foreground',
      'completed': 'bg-success text-success-foreground',
    };
    return styles[status];
  };

  const statusSteps: Task['status'][] = ['open', 'in-progress', 'review', 'completed'];
  const currentStepIndex = statusSteps.indexOf(task.status);

  const canTake = task.status === 'open';
  const isAssignedToMe = task.assigned_to === user?.id;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      return (isImage || isPdf) && isValidSize;
    });
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitProgress = async () => {
    if (!progressContent.trim()) {
      toast({ title: 'Error', description: 'Please add progress content', variant: 'destructive' });
      return;
    }

    const { error } = await addProgress(
      progressContent,
      parseFloat(hoursWorked) || 0,
      parseInt(progressPercentage) || 0,
      selectedFiles
    );

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Progress update added!' });
      setProgressContent('');
      setHoursWorked('');
      setProgressPercentage('');
      setSelectedFiles([]);
      setShowProgressForm(false);
    }
  };

  const skills = task.skills || [];
  const requirements = task.requirements ? task.requirements.split('\n').filter(r => r.trim()) : [];
  const deliverables = task.deliverables ? task.deliverables.split('\n').filter(d => d.trim()) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="task-detail-description">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <DialogTitle className="text-xl">{task.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{task.project?.name || 'No project'}</p>

              {onlineUsers.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Viewing:</span>
                  <div className="flex -space-x-2">
                    <TooltipProvider>
                      {onlineUsers.map((u) => (
                        <Tooltip key={u.user_id}>
                          <TooltipTrigger asChild>
                            <Avatar className={cn("w-6 h-6 border-2 border-background ring-1 ring-background", u.user_id === user?.id ? "ring-accent" : "")}>
                              <AvatarImage src={u.avatar_url} />
                              <AvatarFallback className="text-[10px] bg-primary/10">{u.full_name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>{u.full_name || 'User'} {u.user_id === user?.id && '(You)'}</TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isCreator && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Badge className={getStatusStyles(task.status)}>
                {task.status.replace('-', ' ')}
              </Badge>
            </div>
          </div>
          <DialogDescription id="task-detail-description" className="sr-only">
            Task details and progress management
          </DialogDescription>
          <Badge className={cn('capitalize', getPriorityColor(task.priority), 'ml-auto border')}>
            {task.priority} Priority
          </Badge>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Progression */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Status Progression</h4>
            <div className="flex items-center gap-2 justify-between">
              {statusSteps.map((step, index) => {
                const labels = { 'open': 'Open', 'in-progress': 'In Progress', 'review': 'Review', 'completed': 'Completed' };
                return (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all",
                      index <= currentStepIndex
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}>
                      {index < currentStepIndex ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-center text-muted-foreground whitespace-nowrap">
                      {labels[step]}
                    </span>
                    {index < statusSteps.length - 1 && (
                      <div className={cn(
                        "absolute w-12 sm:w-16 h-0.5 left-1/2",
                        "transform -translate-x-1/2",
                        index < currentStepIndex ? "bg-accent" : "bg-secondary"
                      )} style={{ top: '16px', marginLeft: index === 0 ? '32px' : index === 1 ? '0px' : '-32px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Description</h4>
            {task.description ? (
              <RichTextViewer content={task.description} />
            ) : (
              <p className="text-sm text-muted-foreground">No description provided.</p>
            )}
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Estimated Effort
              </div>
              <p className="font-medium">{task.estimated_hours ? `${task.estimated_hours} hours` : 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                Deadline
              </div>
              <p className="font-medium">
                {task.deadline
                  ? new Date(task.deadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                  : 'No deadline'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="w-3.5 h-3.5" />
                Priority
              </div>
              <Badge variant="outline" className="capitalize">{task.priority}</Badge>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Target className="w-3.5 h-3.5" />
                Difficulty
              </div>
              <Badge variant="outline" className="capitalize">{task.difficulty || 'Not set'}</Badge>
            </div>
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Required Skills</h4>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Requirements */}
          {requirements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Requirements</h4>
              <ul className="space-y-1.5">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Circle className="w-1.5 h-1.5 mt-2 fill-current flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Deliverables</h4>
              <ul className="space-y-1.5">
                {deliverables.map((del, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-success flex-shrink-0" />
                    {del}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Progress Updates */}
          {isAssignedToMe && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Progress Updates
                  </h4>
                  {!showProgressForm && (
                    <Button variant="outline" size="sm" onClick={() => setShowProgressForm(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Update
                    </Button>
                  )}
                </div>

                {showProgressForm && (
                  <div className="p-4 rounded-lg border space-y-3">
                    <div className="space-y-2">
                      <Label>What did you work on?</Label>
                      <Textarea
                        placeholder="Describe your progress..."
                        value={progressContent}
                        onChange={(e) => setProgressContent(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Hours worked</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={hoursWorked}
                          onChange={(e) => setHoursWorked(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Progress (%)</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="100"
                          value={progressPercentage}
                          onChange={(e) => setProgressPercentage(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label>Attachments (PDF or Images)</Label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <Paperclip className="w-4 h-4 mr-2" />
                        Add Attachments
                      </Button>
                      {selectedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedFiles.map((file, index) => (
                            <Badge key={index} variant="secondary" className="gap-1 pr-1">
                              {file.type.startsWith('image/') ? (
                                <FileImage className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              <span className="max-w-[100px] truncate">{file.name}</span>
                              <button type="button" onClick={() => removeFile(index)} className="ml-1 hover:bg-background rounded p-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSubmitProgress} disabled={uploading}>
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Submit Update'
                        )}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowProgressForm(false); setSelectedFiles([]); }}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {progress.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No updates yet</p>
                  ) : (
                    progress.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                        <p className="text-sm">{p.content}</p>
                        {p.attachments && p.attachments.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {p.attachments.map((url, idx) => {
                                const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                return isImage ? (
                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={url}
                                      alt={`Progress attachment ${idx + 1}`}
                                      className="max-w-[200px] max-h-[150px] rounded border hover:opacity-80 transition-opacity cursor-pointer"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-secondary rounded hover:bg-secondary/80"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Attachment {idx + 1}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{p.hours_worked}h worked</span>
                          <span>{p.progress_percentage}% progress</span>
                          <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Submit for Review Button (for assignee) */}
                {isAssignedToMe && task.status === 'in-progress' && (
                  <div className="pt-4 border-t">
                    <Button
                      className="w-full"
                      onClick={async () => {
                        try {
                          await submitTask(task.id);
                          onOpenChange(false);
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                        }
                      }}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Submit for Review
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      A manager will review and approve your work
                    </p>
                  </div>
                )}

                {/* Manager Review Actions */}
                {isManager && task.status === 'review' && !isAssignedToMe && (
                  <div className="pt-4 border-t space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      👀 Manager Review Required
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-success hover:bg-success/90"
                        onClick={async () => {
                          try {
                            await approveTask(task.id);
                            onOpenChange(false);
                          } catch (err: any) {
                            toast({ title: 'Error', description: err.message, variant: 'destructive' });
                          }
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve & Complete
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-warning border-warning hover:bg-warning/10"
                        onClick={async () => {
                          try {
                            await rejectTask(task.id);
                            onOpenChange(false);
                          } catch (err: any) {
                            toast({ title: 'Error', description: err.message, variant: 'destructive' });
                          }
                        }}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Request Changes
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Use discussions to provide feedback before returning
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Dependencies Section */}
          <Separator />
          <TaskDependencies taskId={task.id} />

          {/* Discussion Section */}
          <Separator />
          <TaskDiscussions taskId={task.id} />

          {/* Assignee or Take Task */}
          <div className="pt-4 border-t">
            {isManager ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[100px]">
                  <UserPlus className="w-4 h-4" />
                  Assign To:
                </div>
                <Select
                  value={task.assigned_to || 'none'}
                  onValueChange={async (val) => {
                    if (val !== 'none') {
                      try {
                        await assignTask(task.id, val);
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' });
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[240px]">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : task.assignee ? (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="font-medium">{task.assignee.full_name}</span>
              </div>
            ) : canTake && isAuthenticated ? (
              <Button
                className="w-full"
                onClick={() => onTakeTask?.(task.id)}
              >
                Take This Task
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : !isAuthenticated && canTake ? (
              <p className="text-sm text-center text-muted-foreground">
                Sign in to take this task
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
      <EditTaskModal task={task} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Task?"
        description={`This will permanently delete "${task.title}". This action cannot be undone.`}
      />
    </Dialog>
  );
}
