"use client";
import { useState, useMemo, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Timer,
  User,
  Briefcase,
  Users,
  Crown,
  Shield,
  Camera,
  ChevronDown
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RecentCompletions } from '@/components/dashboard/RecentCompletions';
import { ProgressOverview } from '@/components/dashboard/ProgressOverview';
// Lazy load heavy widgets
const AlertsPanel = lazy(() => import('@/components/dashboard/AlertsPanel').then(mod => ({ default: mod.AlertsPanel })));
const RecentActivityWidget = lazy(() => import('@/components/dashboard/RecentActivityWidget').then(mod => ({ default: mod.RecentActivityWidget })));
const UpcomingDeadlinesWidget = lazy(() => import('@/components/dashboard/UpcomingDeadlinesWidget').then(mod => ({ default: mod.UpcomingDeadlinesWidget })));
const ProjectCard = lazy(() => import('@/components/projects/ProjectCard').then(mod => ({ default: mod.ProjectCard })));
const TaskCard = lazy(() => import('@/components/tasks/TaskCard').then(mod => ({ default: mod.TaskCard })));

import { Skeleton } from '@/components/ui/skeleton';
import { TaskCardSkeleton, ProjectCardSkeleton } from '@/components/ui/card-skeletons';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MemberProfileSheet } from '@/components/dashboard/MemberProfileSheet';
import type { Task, Profile } from '@/types/database';

const Index = () => {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspaceContext();
  const { projects, loading: projectsLoading } = useProjects({ workspaceId: activeWorkspaceId });
  const { tasks, takeTask, loading: tasksLoading } = useTasks({ workspaceId: activeWorkspaceId });
  const { members: teamMembers, teamCount } = useTeamMembers({ workspaceId: activeWorkspaceId });
  const { profile, isAuthenticated, user, isManager } = useAuth();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskFilter, setTaskFilter] = useState<'available' | 'my-tasks' | 'all'>('available');
  const [teamExpanded, setTeamExpanded] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

  // Calculate stats
  const totalProjects = projects.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'review').length;
  const openTasks = tasks.filter(t => t.status === 'open').length;

  const overallProgress = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // My tasks (assigned to current user)
  const myTasks = useMemo(() => {
    return tasks.filter(t => t.assigned_to === user?.id);
  }, [tasks, user?.id]);

  // Available tasks (open status, not assigned)
  const availableTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'open' && !t.assigned_to);
  }, [tasks]);

  // Time tracking stats for current user
  const myTimeStats = useMemo(() => {
    const myCompletedTasks = myTasks.filter(t => t.status === 'completed');
    const myInProgress = myTasks.filter(t => t.status === 'in-progress');
    const totalEstimatedHours = myTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    return {
      totalTasks: myTasks.length,
      completedTasks: myCompletedTasks.length,
      inProgressTasks: myInProgress.length,
      totalEstimatedHours,
    };
  }, [myTasks]);

  // Filtered tasks based on selected tab
  const filteredTasks = useMemo(() => {
    switch (taskFilter) {
      case 'available':
        return availableTasks;
      case 'my-tasks':
        return myTasks;
      case 'all':
      default:
        return tasks;
    }
  }, [taskFilter, availableTasks, myTasks, tasks]);

  const activeProjects = projects.filter(p => p.status === 'active').slice(0, 3);

  const handleTakeTask = async (taskId: string) => {
    if (!isAuthenticated) {
      toast({ title: "Sign in Required", description: "Please sign in to take tasks.", variant: "destructive" });
      return;
    }

    const { error } = await takeTask(taskId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Task Assigned!", description: `You've successfully taken this task!` });
      setSelectedTask(null);
    }
  };

  const handleViewDetails = (task: Task) => {
    if (task.status === 'completed') {
      router.push(`/my-dashboard/${task.id}`);
    } else {
      setSelectedTask(task);
    }
  };

  const alerts = useMemo(() => {
    const a = [];
    const urgentTasks = tasks.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'completed');
    if (urgentTasks.length > 0) a.push({ id: '1', type: 'warning' as const, message: `${urgentTasks.length} high priority tasks need attention`, time: 'Now' });
    if (openTasks > 5) a.push({ id: '2', type: 'info' as const, message: `${openTasks} tasks available to take`, time: 'Now' });
    return a;
  }, [tasks, openTasks]);

  const getStatusColor = (status: Task['status']) => {
    const colors = {
      'open': 'bg-secondary text-secondary-foreground',
      'in-progress': 'bg-accent text-accent-foreground',
      'review': 'bg-warning text-warning-foreground',
      'completed': 'bg-success text-success-foreground',
    };
    return colors[status];
  };

  return (
    <Layout>
      <OnboardingOverlay />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header with Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="animate-fade-in">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              {isAuthenticated ? `Welcome, ${profile?.full_name || 'User'}!` : 'Dashboard'}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {isAuthenticated ? "Manage your tasks and track your work." : "Sign in to take tasks and collaborate."}
            </p>
          </div>
          {isManager && (
            <div className="flex gap-2">
              <CreateTaskModal />
              <CreateProjectModal />
            </div>
          )}
        </div>

        {/* Recent Completions Banner */}
        <RecentCompletions />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <StatsCard title="Team" value={teamCount} subtitle="members" icon={Users} variant="accent" onClick={() => router.push('/admin')} />
          <StatsCard title="Projects" value={totalProjects} subtitle={`${projects.filter(p => p.status === 'active').length} active`} icon={FolderKanban} variant="info" onClick={() => router.push('/projects')} />
          <StatsCard title="Total Tasks" value={totalTasks} subtitle={`${openTasks} available`} icon={ListTodo} variant="warning" onClick={() => router.push('/tasks')} />
          <StatsCard title="Completed" value={completedTasks} icon={CheckCircle2} variant="success" onClick={() => router.push('/tasks?status=completed')} />
          <StatsCard title="In Progress" value={inProgressTasks} icon={Clock} variant="default" onClick={() => router.push('/tasks?status=in-progress')} />
        </div>

        {/* Active Projects */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Active Projects</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/projects')}>
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Suspense fallback={
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            }>
              {activeProjects.map((project) => (
                <ProjectCard key={project.id} project={project} onViewTasks={(projectId) => router.push(`/tasks?project=${projectId}`)} />
              ))}
            </Suspense>
            {activeProjects.length === 0 && (
              <p className="text-muted-foreground col-span-3 text-center py-8">No active projects yet</p>
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="w-5 h-5" />
                Tasks
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/tasks')}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={taskFilter} onValueChange={(v) => setTaskFilter(v as typeof taskFilter)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="available" className="text-xs sm:text-sm">
                  Available ({availableTasks.length})
                </TabsTrigger>
                <TabsTrigger value="my-tasks" className="text-xs sm:text-sm">
                  My Tasks ({myTasks.length})
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  All ({tasks.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={taskFilter} className="mt-0">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      {taskFilter === 'available' && "No available tasks to take right now."}
                      {taskFilter === 'my-tasks' && "You haven't taken any tasks yet."}
                      {taskFilter === 'all' && "No tasks created yet."}
                    </p>
                    {isAuthenticated && taskFilter === 'available' && (
                      <p className="text-sm text-muted-foreground">Check back soon or create a new task!</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <Suspense fallback={
                      <>
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                        <TaskCardSkeleton />
                      </>
                    }>
                      {filteredTasks.slice(0, 8).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onViewDetails={handleViewDetails}
                          onTakeTask={handleTakeTask}
                        />
                      ))}
                    </Suspense>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Progress and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ProgressOverview completed={completedTasks} inProgress={inProgressTasks} upcoming={openTasks} totalProgress={overallProgress} />
          </div>
          <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-xl" />}>
            <AlertsPanel alerts={alerts} />
          </Suspense>
        </div>

        {/* Activity and Deadlines Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
            <UpcomingDeadlinesWidget />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
            <RecentActivityWidget />
          </Suspense>
        </div>

        {/* Team Members Section - Collapsible, Hidden by Default */}
        <Card className="mb-6 overflow-hidden">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setTeamExpanded(!teamExpanded)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-400">
                  <Users className="w-4 h-4 text-white" />
                </div>
                Team Members
                <Badge variant="secondary" className="ml-2">{teamCount}</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <ChevronDown className={cn("w-5 h-5 transition-transform duration-200", teamExpanded && "rotate-180")} />
              </Button>
            </div>
          </CardHeader>
          {teamExpanded && (
            <CardContent className="animate-fade-in">
              <div className="flex flex-wrap gap-3">
                {teamMembers.slice(0, 12).map((member, index) => (
                  <div
                    key={member.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                    }}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer",
                      "animate-fade-in"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Avatar - with photo support */}
                    <div className="relative">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name || 'User'}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-accent/40 shadow-lg avatar-smooth"
                        />
                      ) : (
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-lg",
                          "bg-gradient-to-br",
                          index % 4 === 0 ? "from-blue-500 to-cyan-400" :
                            index % 4 === 1 ? "from-purple-500 to-pink-400" :
                              index % 4 === 2 ? "from-orange-500 to-amber-400" :
                                "from-green-500 to-emerald-400"
                        )}>
                          {member.full_name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                      {/* Online indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-background" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate max-w-[120px] group-hover:text-accent transition-colors">
                        {member.full_name || 'Team Member'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {member.designation || member.department || '✨ Team'}
                      </p>
                    </div>
                  </div>
                ))}
                {teamCount === 0 && (
                  <p className="text-muted-foreground text-sm py-4">No team members yet</p>
                )}
                {teamCount > 12 && (
                  <div className="flex items-center justify-center p-3 rounded-xl bg-secondary/30 border border-dashed border-border">
                    <span className="text-sm text-muted-foreground">+{teamCount - 12} more</span>
                  </div>
                )}
              </div>
              {/* Profile completion reminder for current user */}
              {isAuthenticated && !profile?.avatar_url && (
                <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-warning/20">
                    <Camera className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-warning">Complete your profile</p>
                    <p className="text-xs text-muted-foreground">Add a profile photo so your team can recognize you!</p>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* My Work Summary - Moved to bottom */}
        {isAuthenticated && (
          <Card className="mb-6 overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-accent/20 shadow-lg">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-accent to-accent/70">
                  <User className="w-4 h-4 text-white" />
                </div>
                My Work Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div
                  onClick={() => router.push('/tasks?assignee=me')}
                  className="relative text-center p-4 rounded-xl bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/20 group hover:border-accent/40 transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-accent to-info bg-clip-text text-transparent">{myTimeStats.totalTasks}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">📋 Assigned</p>
                </div>
                <div
                  onClick={() => router.push('/tasks?assignee=me&status=in-progress')}
                  className="relative text-center p-4 rounded-xl bg-gradient-to-br from-warning/20 via-warning/10 to-transparent border border-warning/20 group hover:border-warning/40 transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-warning/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-warning to-orange-400 bg-clip-text text-transparent">{myTimeStats.inProgressTasks}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">⏳ In Progress</p>
                </div>
                <div
                  onClick={() => router.push('/tasks?assignee=me&status=completed')}
                  className="relative text-center p-4 rounded-xl bg-gradient-to-br from-success/20 via-success/10 to-transparent border border-success/20 group hover:border-success/40 transition-all hover:scale-105 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-success/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-success to-emerald-400 bg-clip-text text-transparent">{myTimeStats.completedTasks}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">✅ Completed</p>
                </div>
                <div className="relative text-center p-4 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 group hover:border-primary/40 transition-all hover:scale-105">
                  <div className="absolute inset-0 bg-primary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">{myTimeStats.totalEstimatedHours}h</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">⏱️ Est. Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <TaskDetailModal
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onTakeTask={handleTakeTask}
      />

      <MemberProfileSheet
        member={selectedMember}
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      />
    </Layout>
  );
};

export default Index;
