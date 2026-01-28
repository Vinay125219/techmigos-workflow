import { useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { useRouter, useParams } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Calendar,
  Target,
  TrendingUp,
  ListTodo,
  AlertTriangle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { formatDistanceToNow, format, isAfter, isBefore, addDays } from 'date-fns';
import type { Task } from '@/types/database';
import { MyTaskDetail } from '@/components/tasks/MyTaskDetail';

const MyDashboard = () => {
  const { user, profile, isAuthenticated, loading } = useAuth();
  const { tasks, completeTask } = useTasks();
  const router = useRouter();
  const params = useParams();
  const taskId = params?.taskId as string;

  // Redirect if not authenticated
  if (!loading && !isAuthenticated) {
    router.replace('/auth');
    return null;
  }

  // Show loading state while checking auth
  if (loading) {
    return null;
  }



  const myTasks = useMemo(() => {
    return tasks.filter(t => t.assigned_to === user?.id);
  }, [tasks, user?.id]);

  const stats = useMemo(() => {
    const inProgress = myTasks.filter(t => t.status === 'in-progress');
    const inReview = myTasks.filter(t => t.status === 'review');
    const completed = myTasks.filter(t => t.status === 'completed');
    const overdue = myTasks.filter(t =>
      t.deadline && isBefore(new Date(t.deadline), new Date()) && t.status !== 'completed'
    );
    const upcomingDeadlines = myTasks
      .filter(t =>
        t.deadline &&
        isAfter(new Date(t.deadline), new Date()) &&
        isBefore(new Date(t.deadline), addDays(new Date(), 7)) &&
        t.status !== 'completed'
      )
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());

    const totalHours = myTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const completedHours = completed.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    return {
      total: myTasks.length,
      inProgress: inProgress.length,
      inReview: inReview.length,
      completed: completed.length,
      overdue: overdue.length,
      upcomingDeadlines,
      overdueList: overdue,
      totalHours,
      completedHours,
      completionRate: myTasks.length > 0 ? Math.round((completed.length / myTasks.length) * 100) : 0,
    };
  }, [myTasks]);

  const getStatusColor = (status: Task['status']) => {
    const colors = {
      'open': 'bg-secondary text-secondary-foreground',
      'in-progress': 'bg-accent text-accent-foreground',
      'review': 'bg-warning text-warning-foreground',
      'completed': 'bg-success text-success-foreground',
    };
    return colors[status];
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      'low': 'text-muted-foreground',
      'medium': 'text-foreground',
      'high': 'text-warning',
      'critical': 'text-destructive',
    };
    return colors[priority];
  };

  // If taskId is present, show the task detail view
  if (taskId) {
    const selectedTask = tasks.find(t => t.id === taskId);

    if (selectedTask) {
      return (
        <Layout>
          <div className="container mx-auto px-4 py-8">
            <Button variant="ghost" className="mb-4" onClick={() => router.push('/my-dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
            <div className="max-w-4xl mx-auto">
              <MyTaskDetail
                task={selectedTask}
                onComplete={() => completeTask(selectedTask.id)}
              />
            </div>
          </div>
        </Layout>
      );
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.full_name || 'User'}
            {profile?.designation && <span className="text-primary"> • {profile.designation}</span>}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ListTodo className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overdue Tasks */}
          {stats.overdue > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Overdue Tasks ({stats.overdue})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.overdueList.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDistanceToNow(new Date(task.deadline!), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Deadlines (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.upcomingDeadlines.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No upcoming deadlines</p>
              ) : (
                stats.upcomingDeadlines.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(task.deadline!), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Tasks In Progress */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                My Active Tasks
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/tasks')}>
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTasks.filter(t => t.status === 'in-progress' || t.status === 'review').length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No active tasks</p>
              ) : (
                myTasks
                  .filter(t => t.status === 'in-progress' || t.status === 'review')
                  .slice(0, 5)
                  .map((task) => (
                    <div key={task.id} className="p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium truncate">{task.title}</p>
                        <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                      </div>
                      {task.project && (
                        <p className="text-xs text-muted-foreground">{task.project.name}</p>
                      )}
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Work Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Tasks Completed</span>
                  <span className="font-medium">{stats.completed} / {stats.total}</span>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Hours Logged</span>
                  <span className="font-medium">{stats.completedHours} / {stats.totalHours}h</span>
                </div>
                <Progress
                  value={stats.totalHours > 0 ? (stats.completedHours / stats.totalHours) * 100 : 0}
                  className="h-2"
                />
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-accent">{stats.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{stats.inReview}</p>
                  <p className="text-xs text-muted-foreground">In Review</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MyDashboard;
