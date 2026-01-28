"use client";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/database';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
const STATUSES = ['open', 'in-progress', 'review', 'completed'] as const;
const COMMON_SKILLS = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Design', 'UI/UX', 'Database', 'DevOps', 'Testing'];

interface EditTaskModalProps {
    task: Task;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditTaskModal({ task, open, onOpenChange }: EditTaskModalProps) {
    const { updateTask } = useTasks();
    const { projects } = useProjects();
    const [loading, setLoading] = useState(false);

    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [projectId, setProjectId] = useState(task.project_id || 'none');
    const [priority, setPriority] = useState<typeof PRIORITIES[number]>(task.priority);
    const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>(task.difficulty || 'medium');
    const [status, setStatus] = useState<typeof STATUSES[number]>(task.status);
    const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours?.toString() || '');
    const [deadline, setDeadline] = useState<Date | undefined>(
        task.deadline ? parseISO(task.deadline) : undefined
    );
    const [skills, setSkills] = useState<string[]>(task.skills || []);
    const [newSkill, setNewSkill] = useState('');
    const [requirements, setRequirements] = useState(task.requirements || '');
    const [deliverables, setDeliverables] = useState(task.deliverables || '');

    // Reset form when task changes
    useEffect(() => {
        setTitle(task.title);
        setDescription(task.description || '');
        setProjectId(task.project_id || 'none');
        setPriority(task.priority);
        setDifficulty(task.difficulty || 'medium');
        setStatus(task.status);
        setEstimatedHours(task.estimated_hours?.toString() || '');
        setDeadline(task.deadline ? parseISO(task.deadline) : undefined);
        setSkills(task.skills || []);
        setRequirements(task.requirements || '');
        setDeliverables(task.deliverables || '');
    }, [task]);

    const addSkill = (skill: string) => {
        const trimmed = skill.trim();
        if (trimmed && !skills.includes(trimmed)) {
            setSkills([...skills, trimmed]);
        }
        setNewSkill('');
    };

    const removeSkill = (skill: string) => {
        setSkills(skills.filter(s => s !== skill));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast({ title: 'Error', description: 'Task title is required', variant: 'destructive' });
            return;
        }

        setLoading(true);

        const { error } = await updateTask(task.id, {
            title: title.trim(),
            description: description.trim() || null,
            project_id: projectId && projectId !== 'none' ? projectId : null,
            priority,
            difficulty,
            status,
            estimated_hours: estimatedHours ? parseInt(estimatedHours) : null,
            deadline: deadline ? format(deadline, 'yyyy-MM-dd') : null,
            skills,
            requirements: requirements.trim() || null,
            deliverables: deliverables.trim() || null,
        });

        setLoading(false);

        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Task updated successfully!' });
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-title">Task Title *</Label>
                        <Input
                            id="edit-title"
                            placeholder="Enter task title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                            id="edit-description"
                            placeholder="Describe the task..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Project</Label>
                        <Select value={projectId} onValueChange={setProjectId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select project (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Project</SelectItem>
                                {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map((p) => (
                                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Difficulty</Label>
                            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIFFICULTIES.map((d) => (
                                        <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">{s.replace('-', ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-hours">Estimated Hours</Label>
                            <Input
                                id="edit-hours"
                                type="number"
                                placeholder="e.g., 8"
                                value={estimatedHours}
                                onChange={(e) => setEstimatedHours(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Deadline</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deadline ? format(deadline, 'PPP') : 'Pick a date'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Required Skills</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {skills.map((skill) => (
                                <Badge key={skill} variant="secondary" className="gap-1">
                                    {skill}
                                    <button type="button" onClick={() => removeSkill(skill)}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Add a skill"
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addSkill(newSkill);
                                    }
                                }}
                            />
                            <Button type="button" variant="outline" onClick={() => addSkill(newSkill)}>
                                Add
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {COMMON_SKILLS.filter(s => !skills.includes(s)).slice(0, 5).map((skill) => (
                                <Badge
                                    key={skill}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-secondary"
                                    onClick={() => addSkill(skill)}
                                >
                                    + {skill}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-requirements">Requirements</Label>
                        <Textarea
                            id="edit-requirements"
                            placeholder="List requirements..."
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-deliverables">Deliverables</Label>
                        <Textarea
                            id="edit-deliverables"
                            placeholder="List deliverables..."
                            value={deliverables}
                            onChange={(e) => setDeliverables(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
