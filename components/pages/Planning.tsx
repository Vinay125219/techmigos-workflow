import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket, Calendar, Users, Clock, Target, CheckCircle2,
  ArrowRight, Lightbulb, FolderKanban, AlertTriangle,
  TrendingUp, BarChart3
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useIdeas } from '@/hooks/useIdeas';
import { cn } from '@/lib/utils';
import { format, differenceInDays, addDays } from 'date-fns';

const Planning = () => {
  const router = useRouter();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { ideas } = useIdeas();

  // Project Roadmap - group by status
  const projectRoadmap = useMemo(() => {
    const planned = projects.filter(p => p.status === 'planned');
    const active = projects.filter(p => p.status === 'active');
    const upcoming = projects.filter(p =>
      p.start_date && differenceInDays(new Date(p.start_date), new Date()) > 0
    ).sort((a, b) =>
      new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime()
    );

    return { planned, active, upcoming };
  }, [projects]);

  // Workload distribution
  const workloadStats = useMemo(() => {
    const openTasks = tasks.filter(t => t.status === 'open').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const inReview = tasks.filter(t => t.status === 'review').length;
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    return { openTasks, inProgress, inReview, totalEstimatedHours };
  }, [tasks]);

  // Ideas summary
  const ideasSummary = useMemo(() => {
    const approved = ideas.filter(i => i.status === 'approved');
    const underReview = ideas.filter(i => i.status === 'under-review');
    const topVoted = [...ideas].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 3);

    return { approved, underReview, topVoted };
  }, [ideas]);

  // Upcoming milestones (projects with end dates)
  const milestones = useMemo(() => {
    return projects
      .filter(p => p.end_date && p.status !== 'completed')
      .map(p => ({
        id: p.id,
        name: p.name,
        date: new Date(p.end_date!),
        daysLeft: differenceInDays(new Date(p.end_date!), new Date()),
        progress: p.progress || 0
      }))
      .filter(m => m.daysLeft >= -7 && m.daysLeft <= 60)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [projects]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-secondary',
      active: 'bg-accent',
      completed: 'bg-success',
      'on-hold': 'bg-warning'
    };
    return colors[status] || 'bg-secondary';
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Planning & Roadmap</h1>
            <p className="text-muted-foreground">
              Track project timelines, upcoming milestones, and strategic initiatives.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/projects')}>
              <FolderKanban className="w-4 h-4 mr-2" /> All Projects
            </Button>
            <Button onClick={() => router.push('/ideas')}>
              <Lightbulb className="w-4 h-4 mr-2" /> Ideas
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="card-hover cursor-pointer" onClick={() => router.push('/projects?status=active')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Rocket className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectRoadmap.active.length}</p>
                  <p className="text-xs text-muted-foreground">Active Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover cursor-pointer" onClick={() => router.push('/projects?status=planned')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/20">
                  <Calendar className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectRoadmap.planned.length}</p>
                  <p className="text-xs text-muted-foreground">Planned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover cursor-pointer" onClick={() => router.push('/tasks?status=open')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <Target className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{workloadStats.openTasks}</p>
                  <p className="text-xs text-muted-foreground">Open Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover cursor-pointer" onClick={() => router.push('/ideas')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <Lightbulb className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ideasSummary.approved.length}</p>
                  <p className="text-xs text-muted-foreground">Approved Ideas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Upcoming Milestones */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Upcoming Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No upcoming milestones</p>
                  <p className="text-xs mt-1">Set end dates on projects to see milestones here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      onClick={() => router.push(`/projects?highlight=${milestone.id}`)}
                      className="p-4 rounded-lg border hover:border-accent/50 cursor-pointer transition-all hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{milestone.name}</h4>
                        <Badge
                          variant={milestone.daysLeft < 0 ? 'destructive' : milestone.daysLeft <= 7 ? 'default' : 'outline'}
                          className={milestone.daysLeft < 0 ? '' : milestone.daysLeft <= 7 ? 'bg-warning text-warning-foreground' : ''}
                        >
                          {milestone.daysLeft < 0
                            ? `${Math.abs(milestone.daysLeft)}d overdue`
                            : milestone.daysLeft === 0
                              ? 'Due today'
                              : `${milestone.daysLeft}d left`}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={milestone.progress} className="flex-1 h-2" />
                        <span className="text-sm font-medium w-12 text-right">{milestone.progress}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Due: {format(milestone.date, 'MMM d, yyyy')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Ideas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-warning" />
                  Top Ideas
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push('/ideas')}>
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ideasSummary.topVoted.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ideas yet</p>
                  <Button size="sm" className="mt-3" onClick={() => router.push('/ideas')}>
                    Submit an Idea
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {ideasSummary.topVoted.map((idea, index) => (
                    <div
                      key={idea.id}
                      onClick={() => router.push(`/ideas?highlight=${idea.id}`)}
                      className="p-3 rounded-lg border hover:border-accent/50 cursor-pointer transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                          index === 0 ? "bg-yellow-500 text-white" :
                            index === 1 ? "bg-gray-400 text-white" :
                              "bg-amber-600 text-white"
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{idea.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{idea.votes} votes</Badge>
                            <Badge className={cn("text-xs capitalize",
                              idea.status === 'approved' ? 'bg-success' :
                                idea.status === 'under-review' ? 'bg-warning' : 'bg-secondary'
                            )}>
                              {idea.status.replace('-', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Pipeline */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Project Pipeline
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Planned */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-secondary" />
                  Planned ({projectRoadmap.planned.length})
                </h3>
                <div className="space-y-2">
                  {projectRoadmap.planned.slice(0, 4).map(project => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects?highlight=${project.id}`)}
                      className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                    >
                      <p className="font-medium text-sm">{project.name}</p>
                      {project.start_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Starts: {format(new Date(project.start_date), 'MMM d')}
                        </p>
                      )}
                    </div>
                  ))}
                  {projectRoadmap.planned.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No planned projects</p>
                  )}
                </div>
              </div>

              {/* Active */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent" />
                  Active ({projectRoadmap.active.length})
                </h3>
                <div className="space-y-2">
                  {projectRoadmap.active.slice(0, 4).map(project => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects?highlight=${project.id}`)}
                      className="p-3 rounded-lg bg-accent/10 hover:bg-accent/20 cursor-pointer transition-colors"
                    >
                      <p className="font-medium text-sm">{project.name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={project.progress || 0} className="flex-1 h-1.5" />
                        <span className="text-xs font-medium">{project.progress || 0}%</span>
                      </div>
                    </div>
                  ))}
                  {projectRoadmap.active.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No active projects</p>
                  )}
                </div>
              </div>

              {/* Upcoming */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info" />
                  Starting Soon
                </h3>
                <div className="space-y-2">
                  {projectRoadmap.upcoming.slice(0, 4).map(project => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects?highlight=${project.id}`)}
                      className="p-3 rounded-lg bg-info/10 hover:bg-info/20 cursor-pointer transition-colors"
                    >
                      <p className="font-medium text-sm">{project.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        In {differenceInDays(new Date(project.start_date!), new Date())} days
                      </p>
                    </div>
                  ))}
                  {projectRoadmap.upcoming.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming starts</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workload Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              Workload Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-secondary/30">
                <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold">{workloadStats.totalEstimatedHours}h</p>
                <p className="text-xs text-muted-foreground">Total Estimated</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/10">
                <Target className="w-6 h-6 mx-auto mb-2 text-warning" />
                <p className="text-2xl font-bold">{workloadStats.openTasks}</p>
                <p className="text-xs text-muted-foreground">Awaiting Assignment</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-accent/10">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-accent" />
                <p className="text-2xl font-bold">{workloadStats.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-info/10">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-info" />
                <p className="text-2xl font-bold">{workloadStats.inReview}</p>
                <p className="text-xs text-muted-foreground">In Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Planning;
