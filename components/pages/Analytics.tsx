import { useRouter } from 'next/navigation';
import { TrendingUp, Calendar, BarChart3, PieChart, ArrowUp, Download, FileText, Activity, User, ExternalLink } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { useAuth } from '@/contexts/AuthContext';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const Analytics = () => {
  const router = useRouter();
  const { isManager, isAdmin } = useAuth();
  const { analytics, loading } = useAnalytics();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  // Admins/Managers see full history, regular users see only 25 events
  const logLimit = (isManager || isAdmin) ? 500 : 25;
  const { logs, loading: logsLoading, getActivityIcon, getActivityColor } = useActivityLogs(logLimit);

  const handleExport = (format: 'pdf' | 'csv-projects' | 'csv-tasks' | 'csv-summary') => {
    const data = {
      projects,
      tasks,
      profiles: [],
      dateRange: { start: new Date(), end: new Date() },
    };

    if (format === 'pdf') {
      exportToPDF(data);
      toast({ title: 'Export Started', description: 'PDF report will open in a new tab for printing.' });
    } else if (format === 'csv-projects') {
      exportToCSV(data, 'projects');
      toast({ title: 'Export Complete', description: 'Projects CSV downloaded.' });
    } else if (format === 'csv-tasks') {
      exportToCSV(data, 'tasks');
      toast({ title: 'Export Complete', description: 'Tasks CSV downloaded.' });
    } else {
      exportToCSV(data, 'summary');
      toast({ title: 'Export Complete', description: 'Summary CSV downloaded.' });
    }
  };

  if (loading || !analytics) {
    return <Layout><div className="container mx-auto px-4 py-8 text-center"><p>Loading analytics...</p></div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Analytics & Insights</h1>
            <p className="text-muted-foreground">Track progress, analyze workload, and monitor completion trends.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv-summary')}>
                <Download className="w-4 h-4 mr-2" />
                Summary (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv-projects')}>
                <Download className="w-4 h-4 mr-2" />
                Projects (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv-tasks')}>
                <Download className="w-4 h-4 mr-2" />
                Tasks (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* System Health & Usage Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health & Usage
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Counts are real from project/task records. Storage usage is real from documents file sizes.
            Limits are {analytics.dataUsage.limitsSource === 'env' ? 'configured from environment values' : 'default placeholders'}.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Project Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-2">
                  <span>{analytics.dataUsage.projectsCount} used</span>
                  <span className="text-muted-foreground">Limit: {analytics.dataUsage.projectsLimit}</span>
                </div>
                <Progress value={(analytics.dataUsage.projectsCount / analytics.dataUsage.projectsLimit) * 100} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Task Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-2">
                  <span>{analytics.dataUsage.tasksCount} used</span>
                  <span className="text-muted-foreground">Limit: {analytics.dataUsage.tasksLimit}</span>
                </div>
                <Progress value={(analytics.dataUsage.tasksCount / analytics.dataUsage.tasksLimit) * 100} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-2">
                  <span>{analytics.dataUsage.storageUsed} MB used</span>
                  <span className="text-muted-foreground">Limit: {analytics.dataUsage.storageLimit} MB</span>
                </div>
                <Progress value={(analytics.dataUsage.storageUsed / analytics.dataUsage.storageLimit) * 100} className="h-2" />
              </CardContent>
            </Card>
          </div>
          {(analytics.dataUsage.tasksCount > analytics.dataUsage.tasksLimit * 0.8 ||
            analytics.dataUsage.storageUsed > analytics.dataUsage.storageLimit * 0.8) && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Usage Warning</AlertTitle>
                <AlertDescription>
                  You are approaching your system limits. Please contact support or upgrade your plan.
                </AlertDescription>
              </Alert>
            )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-3xl font-bold gradient-text">{analytics.completionRate}%</p>
                </div>
                <div className="p-3 rounded-xl bg-success/20"><TrendingUp className="w-6 h-6 text-success" /></div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-success"><ArrowUp className="w-4 h-4" /><span>+{analytics.weeklyCompletionRate}% this week</span></div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Projects</p>
                  <p className="text-3xl font-bold">{analytics.activeProjects}</p>
                </div>
                <div className="p-3 rounded-xl bg-accent/20"><BarChart3 className="w-6 h-6 text-accent" /></div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{analytics.completedProjects} completed</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks This Week</p>
                  <p className="text-3xl font-bold">{analytics.inProgressTasks}</p>
                </div>
                <div className="p-3 rounded-xl bg-warning/20"><Calendar className="w-6 h-6 text-warning" /></div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{analytics.tasksByPriority.filter(p => p.priority === 'high' || p.priority === 'critical').reduce((a, b) => a + b.count, 0)} high priority</p>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Backlog Size</p>
                  <p className="text-3xl font-bold">{analytics.openTasks}</p>
                </div>
                <div className="p-3 rounded-xl bg-info/20"><PieChart className="w-6 h-6 text-info" /></div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Awaiting assignment</p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="card-hover">
            <CardHeader><CardTitle className="text-lg">Weekly Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}
                      cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                    />
                    <Legend />
                    <Bar dataKey="tasksCreated" name="Created" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tasksCompleted" name="Completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader><CardTitle className="text-lg">Task Status Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={analytics.tasksByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {analytics.tasksByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={[
                          'hsl(var(--muted))', // open
                          'hsl(var(--accent))', // in-progress
                          'hsl(var(--warning))', // review
                          'hsl(var(--success))'  // completed
                        ][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Legend />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="card-hover">
            <CardHeader><CardTitle className="text-lg">Priority Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.tasksByPriority.map(({ priority, count }) => {
                  const percentage = analytics.totalTasks > 0 ? Math.round((count / analytics.totalTasks) * 100) : 0;
                  const colors: Record<string, string> = { critical: 'bg-destructive', high: 'bg-warning', medium: 'bg-info', low: 'bg-secondary' };
                  return (
                    <div key={priority} className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="capitalize">{priority}</span><span className="font-medium">{count} ({percentage}%)</span></div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className={cn("h-full rounded-full", colors[priority])} style={{ width: `${percentage}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="card-hover">
            <CardHeader><CardTitle className="text-lg">Top Contributors</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topContributors.slice(0, 5).map((contributor, i) => (
                  <div key={contributor.user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-semibold text-accent">
                      {contributor.user.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{contributor.user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{contributor.tasksCompleted} tasks • {contributor.hoursWorked.toFixed(1)}h</p>
                    </div>
                    <Badge variant="outline">#{i + 1}</Badge>
                  </div>
                ))}
                {analytics.topContributors.length === 0 && <p className="text-muted-foreground text-center py-4">No contributors yet</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="card-hover mb-8">
          <CardHeader><CardTitle className="text-lg">Project Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.projectProgress.slice(0, 5).map((project) => (
                <div
                  key={project.name}
                  className="space-y-2 p-3 -mx-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                  onClick={() => router.push(`/projects?highlight=${project.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate mr-4 group-hover:text-accent transition-colors">{project.name}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{project.completedTasks}/{project.taskCount} tasks</Badge>
                      <span className="text-sm font-bold w-12 text-right">{project.progress}%</span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full animate-progress" style={{ width: `${project.progress}%`, background: 'var(--gradient-primary)' }} />
                  </div>
                </div>
              ))}
              {analytics.projectProgress.length === 0 && <p className="text-muted-foreground text-center py-4">No projects yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Full Activity Logs Section */}
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <CardTitle className="text-lg">Complete Activity History</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {logs.length} total events
            </Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading activity logs...</div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No activity recorded yet</div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const iconName = getActivityIcon(log.action_type);
                    const colorClass = getActivityColor(log.action_type);
                    const isClickable = log.entity_type && log.entity_id;

                    const handleClick = () => {
                      if (isClickable) {
                        let path = '';
                        switch (log.entity_type) {
                          case 'project': path = `/projects?highlight=${log.entity_id}`; break;
                          case 'task': path = `/tasks?highlight=${log.entity_id}`; break;
                          case 'idea': path = `/ideas?highlight=${log.entity_id}`; break;
                          default: return;
                        }
                        router.push(path);
                      }
                    };

                    return (
                      <div
                        key={log.id}
                        onClick={handleClick}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg transition-colors border border-transparent",
                          isClickable ? "cursor-pointer hover:bg-accent/5 hover:border-accent/30" : "hover:bg-muted/50 hover:border-border"
                        )}
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={log.user?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-accent/10 text-accent">
                            {log.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || <User className="w-3 h-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm">{log.user?.full_name || 'System'}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{log.description}</p>
                          {log.entity_title && (
                            <Badge variant="secondary" className={cn("mt-1 text-xs", isClickable && "hover:bg-accent/20")}>
                              {log.entity_type}: {log.entity_title}
                              {isClickable && <ExternalLink className="w-2.5 h-2.5 ml-1 inline" />}
                            </Badge>
                          )}
                        </div>
                        <div className={cn("p-1.5 rounded-md flex-shrink-0 text-sm", colorClass)}>
                          {iconName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Analytics;
