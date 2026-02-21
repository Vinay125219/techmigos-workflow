"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useRecurringTasks } from '@/hooks/useRecurringTasks';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface TaskAutomationPanelProps {
  workspaceId?: string | null;
}

export function TaskAutomationPanel({ workspaceId }: TaskAutomationPanelProps) {
  const { isManager } = useAuth();
  const { templates, createTemplate, instantiateTemplate } = useTaskTemplates({ workspaceId });
  const { createRecurringTask } = useRecurringTasks({ workspaceId });
  const [templateName, setTemplateName] = useState('');
  const [templateTitle, setTemplateTitle] = useState('');
  const [recurringTitle, setRecurringTitle] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  if (!isManager) return null;

  const handleCreateTemplate = async () => {
    if (!templateName.trim() || !templateTitle.trim()) {
      toast({ title: 'Template data required', description: 'Name and title are required', variant: 'destructive' });
      return;
    }

    const { error } = await createTemplate({
      name: templateName.trim(),
      title: templateTitle.trim(),
      description: null,
      priority: 'medium',
      difficulty: null,
      estimated_hours: null,
      requirements: null,
      deliverables: null,
      skills: [],
      project_id: null,
      workspace_id: workspaceId || null,
    });

    if (error) {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Template created', description: 'Task template saved.' });
    setTemplateName('');
    setTemplateTitle('');
  };

  const handleCreateRecurring = async () => {
    if (!recurringTitle.trim()) {
      toast({ title: 'Recurring title required', description: 'Provide task title', variant: 'destructive' });
      return;
    }

    const nextRun = new Date();
    const { error } = await createRecurringTask({
      template_id: null,
      title: recurringTitle.trim(),
      description: null,
      frequency: recurringFrequency,
      interval_value: 1,
      next_run_at: nextRun.toISOString(),
      project_id: null,
      workspace_id: workspaceId || null,
      active: true,
    });

    if (error) {
      toast({ title: 'Failed to create recurring task', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Recurring task configured', description: 'The scheduler will generate due tasks automatically.' });
    setRecurringTitle('');
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Task Templates & Recurring Jobs</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="font-medium">Create Template</h3>
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Default Task Title</Label>
            <Input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} />
          </div>
          <Button onClick={handleCreateTemplate}>Save Template</Button>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Create Recurring Task</h3>
          <div className="space-y-2">
            <Label>Task Title</Label>
            <Input value={recurringTitle} onChange={(event) => setRecurringTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={recurringFrequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setRecurringFrequency(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateRecurring}>Save Recurring Rule</Button>
        </div>

        <div className="lg:col-span-2 space-y-2">
          <h3 className="font-medium">Existing Templates</h3>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates created yet.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">{template.title}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const { error } = await instantiateTemplate(template);
                      if (error) {
                        toast({ title: 'Failed', description: error.message, variant: 'destructive' });
                        return;
                      }
                      toast({ title: 'Task created', description: 'Template instantiated successfully.' });
                    }}
                  >
                    Create Task
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
