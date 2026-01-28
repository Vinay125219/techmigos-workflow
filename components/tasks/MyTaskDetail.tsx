import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTaskProgress, useTasks } from '@/hooks/useTasks'; // Changed import
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { TaskDiscussions } from './TaskDiscussions';
import { TaskDependencies } from './TaskDependencies';
import {
    Clock, Calendar, Target, CheckCircle2,
    MessageSquare, Plus, Paperclip, FileImage, FileText, X, Loader2
} from 'lucide-react';
import type { Task } from '@/types/database';

interface MyTaskDetailProps {
    task: Task;
    onComplete?: () => void; // Optional now
}

export function MyTaskDetail({ task, onComplete }: MyTaskDetailProps) {
    const { user, isManager } = useAuth();
    const { submitTask, approveTask, rejectTask } = useTasks();
    const { progress, addProgress, uploading } = useTaskProgress(task.id);
    const [showProgressForm, setShowProgressForm] = useState(false);
    const [progressContent, setProgressContent] = useState('');
    const [hoursWorked, setHoursWorked] = useState('');
    const [progressPercentage, setProgressPercentage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived State
    const latestProgress = progress.length > 0 ? progress[0].progress_percentage : 0;
    const isAssignee = user?.id === task.assigned_to;
    // Reviewer can be task creator OR any Manager/Admin
    const isReviewer = user?.id === task.created_by || isManager;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(file => {
            const isImage = file.type.startsWith('image/');
            const isPdf = file.type === 'application/pdf';
            const isValidSize = file.size <= 10 * 1024 * 1024;
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

    const getStatusStyles = (status: string) => {
        const styles: Record<string, string> = {
            'open': 'bg-secondary text-secondary-foreground',
            'in-progress': 'bg-accent text-accent-foreground',
            'review': 'bg-warning text-warning-foreground',
            'completed': 'bg-success text-success-foreground',
        };
        return styles[status] || 'bg-secondary';
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{task.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{task.project?.name || 'No project'}</p>
                    </div>
                    <Badge className={getStatusStyles(task.status)}>
                        {task.status.replace('-', ' ')}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Description */}
                <div>
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">{task.description || 'No description provided.'}</p>
                </div>

                <Separator />

                {/* Meta Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            Estimated
                        </div>
                        <p className="font-medium">{task.estimated_hours ? `${task.estimated_hours}h` : 'Not set'}</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            Deadline
                        </div>
                        <p className="font-medium text-sm">
                            {task.deadline
                                ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

                <Separator />

                {/* Progress Updates */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Progress Updates
                        </h4>
                        {/* Only assignee can add updates/attachments on in-progress or completed tasks */}
                        {!showProgressForm && isAssignee && (task.status === 'in-progress' || task.status === 'completed') && (
                            <Button variant="outline" size="sm" onClick={() => setShowProgressForm(true)}>
                                <Plus className="w-4 h-4 mr-1" />
                                {task.status === 'completed' ? 'Add Attachment' : 'Add Update'}
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

                            <div className="space-y-2">
                                <Label>Attachments</Label>
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

                    {/* Workflow Actions */}
                    <div className="flex flex-col gap-4 mt-8 pt-4 border-t">
                        {task.status === 'in-progress' && isAssignee && (
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                                <div>
                                    <h4 className="font-medium">Submit for Review</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Current Progress: {latestProgress}%
                                        {latestProgress < 100 && " (100% required)"}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => submitTask(task.id)}
                                    disabled={latestProgress < 100}
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Submit for Review
                                </Button>
                            </div>
                        )}

                        {task.status === 'review' && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-yellow-700 dark:text-yellow-500">Under Review</h4>
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">Waiting for approval</Badge>
                                </div>

                                {isReviewer ? (
                                    <div className="space-y-4">
                                        <p className="text-sm">As the creator, please verify the work. Once approved, the task will be completed and locked.</p>
                                        <div className="flex gap-3">
                                            <Button onClick={() => approveTask(task.id)} className="bg-green-600 hover:bg-green-700">Approve & Complete</Button>
                                            <Button onClick={() => rejectTask(task.id)} variant="destructive">Reject & Return</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">This task is waiting for review by the creator.</p>
                                )}
                            </div>
                        )}

                        {task.status === 'completed' && (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-center gap-2 text-green-700 font-medium">
                                <CheckCircle2 className="w-5 h-5" />
                                Task Completed & Locked
                            </div>
                        )}
                    </div>

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
                                                <div className="flex flex-wrap gap-2">
                                                    {p.attachments.map((url, idx) => {
                                                        const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                                        const isPdf = url.toLowerCase().endsWith('.pdf');

                                                        if (isImage) {
                                                            return (
                                                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block group relative">
                                                                    <img
                                                                        src={url}
                                                                        alt={`Progress attachment ${idx + 1}`}
                                                                        className="max-w-[200px] max-h-[150px] rounded border hover:opacity-80 transition-opacity cursor-pointer object-cover bg-secondary/20"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                                        <span className="text-white text-xs font-medium">View Full</span>
                                                                    </div>
                                                                </a>
                                                            );
                                                        }

                                                        if (isPdf) {
                                                            return (
                                                                <a
                                                                    key={idx}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex flex-col items-center justify-center w-[120px] h-[100px] bg-red-50 border border-red-100 rounded hover:bg-red-100 transition-all p-2 gap-2 group"
                                                                >
                                                                    <FileText className="w-8 h-8 text-red-500 group-hover:scale-110 transition-transform" />
                                                                    <span className="text-xs font-medium text-red-700 text-center truncate w-full">View PDF</span>
                                                                </a>
                                                            );
                                                        }

                                                        // Default file fallback
                                                        return (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 px-3 py-2 text-xs bg-secondary rounded hover:bg-secondary/80 border"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                                Attachment {idx + 1}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
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

                    {task.status === 'in-progress' && (
                        <div className="pt-4 border-t">
                            <Button className="w-full" onClick={onComplete}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Mark as Complete
                            </Button>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Dependencies */}
                <TaskDependencies taskId={task.id} />

                <Separator />

                {/* Discussions */}
                <TaskDiscussions taskId={task.id} />
            </CardContent>
        </Card>
    );
}
