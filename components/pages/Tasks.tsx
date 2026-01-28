"use client";
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFilters, type TaskFiltersState } from '@/components/tasks/TaskFilters';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { Badge } from '@/components/ui/badge';
import { TaskCardSkeleton } from '@/components/ui/card-skeletons';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/database';

import { LayoutGrid, Columns } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { supabase } from '@/integrations/supabase/client';

const Tasks = () => {
  const { tasks, takeTask, loading } = useTasks();
  const { isAuthenticated, user, isManager } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'board'>('grid');

  const handleTaskUpdate = async (task: Task, newStatus: string) => {
    // 1. Optimistic Update (Assuming tasks comes from useTasks hook which exposes setTasks or we mutate it locally via SWR/Query revalidation)
    // Since useTasks returns `tasks`, we rely on Realtime which we verified is active.
    // So we just fire the update to Supabase, and the realtime subscription in useTasks will update the UI automatically!
    // BUT for "instant" drag feel, we might want local mutation if realtime has latency. 
    // For now, let's trust Realtime or just fire the update.

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', task.id);

    if (error) {
      toast({ title: "Error updating task", description: error.message, variant: "destructive" });
      // Revert if needed? Realtime will handle sync.
    } else {
      toast({ title: "Task moved", description: `Task moved to ${newStatus.replace('_', ' ')}` });
    }
  };

  const handleViewDetails = (task: Task) => {
    if (task.status === 'completed') {
      router.push(`/my-dashboard/${task.id}`);
    } else {
      setSelectedTask(task);
    }
  };

  // Get filters from URL
  const projectFilter = searchParams.get('project');
  const statusFromUrl = searchParams.get('status');
  const assigneeFromUrl = searchParams.get('assignee');
  const filteredProject = projectFilter ? tasks.find(t => t.project_id === projectFilter)?.project : null;

  const [filters, setFilters] = useState<TaskFiltersState>({
    search: '',
    priority: 'all',
    difficulty: 'all',
    skill: 'all',
    status: statusFromUrl || 'available',
    sortBy: 'newest',
    assignee: assigneeFromUrl || 'all',
  });

  // Update filters when URL status or assignee changes
  useEffect(() => {
    const newFilters: Partial<TaskFiltersState> = {};
    const currentStatusFromUrl = searchParams.get('status');
    const currentAssigneeFromUrl = searchParams.get('assignee');

    if (currentStatusFromUrl && currentStatusFromUrl !== filters.status) {
      newFilters.status = currentStatusFromUrl;
    }
    if (currentAssigneeFromUrl && currentAssigneeFromUrl !== filters.assignee) {
      newFilters.assignee = currentAssigneeFromUrl;
    }

    if (Object.keys(newFilters).length > 0) {
      setFilters(prev => ({ ...prev, ...newFilters }));
    }
  }, [searchParams, filters.status, filters.assignee]);

  // Handle highlight from notification click
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && !loading) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.querySelector(`[data-entity-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-glow');
          setTimeout(() => {
            element.classList.remove('highlight-glow');
          }, 3000);
        }
        // Clear the highlight param
        const params = new URLSearchParams(searchParams.toString());
        params.delete('highlight');
        router.replace(`?${params.toString()}`, { scroll: false });
      }, 500);
    }
  }, [searchParams, loading, router]);

  const availableSkills = useMemo(() => {
    const skills = new Set<string>();
    tasks.forEach(task => (task.skills || []).forEach(skill => skills.add(skill)));
    return Array.from(skills).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    // Filter by project if specified in URL
    if (projectFilter) {
      result = result.filter(task => task.project_id === projectFilter);
    }
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(query) ||
        (task.description || '').toLowerCase().includes(query) ||
        (task.project?.name || '').toLowerCase().includes(query)
      );
    }
    if (filters.priority !== 'all') result = result.filter(task => task.priority === filters.priority);
    if (filters.difficulty !== 'all') result = result.filter(task => task.difficulty === filters.difficulty);
    if (filters.skill !== 'all') result = result.filter(task => (task.skills || []).includes(filters.skill));
    // Status filtering: 'available' shows open + in-progress (marketplace default)
    // IGNORE status filter if in BOARD mode, because board shows all columns!
    if (viewMode !== 'board') {
      if (filters.status === 'available') {
        result = result.filter(task => task.status === 'open' || task.status === 'in-progress');
      } else if (filters.status !== 'all') {
        result = result.filter(task => task.status === filters.status);
      }
    }
    if (filters.assignee === 'me' && isAuthenticated) result = result.filter(task => task.assigned_to === (user?.id));

    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    switch (filters.sortBy) {
      case 'deadline': result.sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime()); break;
      case 'priority': result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]); break;
      case 'effort': result.sort((a, b) => (a.estimated_hours || 0) - (b.estimated_hours || 0)); break;
      default: result.reverse();
    }
    return result;
  }, [tasks, filters]);

  const stats = useMemo(() => {
    // If a project is selected, calculate stats only for that project
    const sourceTasks = projectFilter
      ? tasks.filter(t => t.project_id === projectFilter)
      : tasks;

    return {
      available: sourceTasks.filter(t => t.status === 'open').length,
      inProgress: sourceTasks.filter(t => t.status === 'in-progress').length,
      review: sourceTasks.filter(t => t.status === 'review').length,
      completed: sourceTasks.filter(t => t.status === 'completed').length,
    };
  }, [tasks, projectFilter]);

  const handleTakeTask = async (taskId: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in Required", description: "Please sign in to take tasks.", variant: "destructive" });
      return;
    }
    const { error } = await takeTask(taskId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Task Assigned!" }); setSelectedTask(null); }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {filteredProject ? `Tasks: ${filteredProject.name}` : 'Task Marketplace'}
            </h1>
            <p className="text-muted-foreground">
              {filteredProject
                ? <span>Viewing tasks for this project. <button className="text-accent underline" onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('project');
                  router.replace(`?${params.toString()}`);
                }}>View all tasks</button></span>
                : 'Browse available tasks and take on work that matches your expertise.'}
            </p>
          </div>
          {isManager && <CreateTaskModal />}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: 'available' }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              filters.status === 'available'
                ? "bg-secondary ring-2 ring-accent shadow-lg"
                : "bg-secondary/50 hover:bg-secondary"
            )}
          >
            <span className="font-bold mr-1">{stats.available}</span> Available
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: 'in-progress' }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              filters.status === 'in-progress'
                ? "bg-accent text-accent-foreground ring-2 ring-accent shadow-lg"
                : "bg-accent/70 text-accent-foreground hover:bg-accent"
            )}
          >
            <span className="font-bold mr-1">{stats.inProgress}</span> In Progress
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: 'review' }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              filters.status === 'review'
                ? "bg-warning text-warning-foreground ring-2 ring-warning shadow-lg"
                : "bg-warning/70 text-warning-foreground hover:bg-warning"
            )}
          >
            <span className="font-bold mr-1">{stats.review}</span> In Review
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: 'completed' }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              filters.status === 'completed'
                ? "bg-success text-success-foreground ring-2 ring-success shadow-lg"
                : "bg-success/70 text-success-foreground hover:bg-success"
            )}
          >
            <span className="font-bold mr-1">{stats.completed}</span> Completed
          </button>
          <button
            onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              filters.status === 'all'
                ? "bg-muted ring-2 ring-foreground/20 shadow-lg"
                : "bg-muted/50 hover:bg-muted"
            )}
          >
            All Tasks
          </button>
        </div>

        <div className="mb-6"><TaskFilters filters={filters} onFiltersChange={setFilters} availableSkills={availableSkills} /></div>
        <div className="mb-4 text-sm text-muted-foreground">Showing {filteredTasks.length} of {tasks.length} tasks</div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredTasks.length > 0 ? (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence mode='popLayout'>
              {filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task} onViewDetails={handleViewDetails} onTakeTask={handleTakeTask} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center py-16"><p className="text-muted-foreground">No tasks found.</p></div>
        )}
      </div>
      <TaskDetailModal task={selectedTask} open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)} onTakeTask={handleTakeTask} />
    </Layout>
  );
};

export default Tasks;
