"use client";
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CalendarIcon, X } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
const COMMON_SKILLS = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Design', 'UI/UX', 'Database', 'DevOps', 'Testing'];

export function CreateTaskModal() {
  const { createTask } = useTasks();
  const { activeWorkspaceId, activeWorkspace } = useWorkspaceContext();
  const { projects } = useProjects({ workspaceId: activeWorkspaceId });
  const { members: teamMembers } = useTeamMembers({ workspaceId: activeWorkspaceId });
  const { isManager } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('medium');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [requirements, setRequirements] = useState('');
  const [deliverables, setDeliverables] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProjectId('');
    setAssignedTo('');
    setPriority('medium');
    setDifficulty('medium');
    setEstimatedHours('');
    setDeadline(undefined);
    setSkills([]);
    setNewSkill('');
    setRequirements('');
    setDeliverables('');
  };

  // Only Managers and Admins can create tasks
  if (!isManager) {
    return null;
  }

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

    const { error } = await createTask({
      title: title.trim(),
      description: description.trim() || null,
      project_id: projectId && projectId !== 'none' ? projectId : null,
      workspace_id: activeWorkspaceId,
      priority,
      difficulty,
      estimated_hours: estimatedHours ? parseInt(estimatedHours) : null,
      deadline: deadline ? format(deadline, 'yyyy-MM-dd') : null,
      skills,
      requirements: requirements.trim() || null,
      deliverables: deliverables.trim() || null,
      status: 'open',
      assigned_to: assignedTo && assignedTo !== 'none' ? assignedTo : null,
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Task created successfully!' });
      resetForm();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          {activeWorkspace && (
            <p className="text-sm text-muted-foreground">
              Workspace: <span className="font-medium">{activeWorkspace.name}</span>
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe the task details, context, and goals..."
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

          <div className="space-y-2">
            <Label>Assignee (Optional)</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours">Estimated Hours</Label>
              <Input
                id="hours"
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
            <Label htmlFor="requirements">Requirements (one per line)</Label>
            <Textarea
              id="requirements"
              placeholder="List requirements..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverables">Deliverables (one per line)</Label>
            <Textarea
              id="deliverables"
              placeholder="List deliverables..."
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
