"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  BarChart3,
  Users,
  FileText,
  Bell,
  ClipboardCheck,
  Database,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  UserMinus,
  Download,
  Filter,
  Search,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { useGovernanceActions } from '@/hooks/useGovernanceActions';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, subDays, subWeeks, subMonths } from 'date-fns';
import { exportToCSV } from '@/utils/exportUtils';

const Admin = () => {
  const router = useRouter();
  const { isAdmin, user, loading: authLoading } = useAuth();
  const { users, loading: usersLoading, updateUserRole } = useAdminUsers();
  const { tasks } = useTasks();
  const { projects, deleteProject } = useProjects();
  const { logs } = useActivityLogs(1000);
  const { actions, approveAction, rejectAction } = useGovernanceActions();

  // Audit log filters
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logDateFilter, setLogDateFilter] = useState('all');
  const [logSearch, setLogSearch] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState<Array<{ id: string, title: string, message: string, date: Date }>>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push('/');
  }, [isAdmin, authLoading, router]);

  // System stats
  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => logs.some(l => l.user?.id === u.id)).length,
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    openTasks: tasks.filter(t => t.status === 'open').length,
    inReview: tasks.filter(t => t.status === 'review').length,
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
  }), [users, projects, tasks, logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (logUserFilter !== 'all') {
      result = result.filter(l => l.user?.id === logUserFilter);
    }

    if (logDateFilter !== 'all') {
      const now = new Date();
      let cutoff = now;
      if (logDateFilter === 'week') cutoff = subWeeks(now, 1);
      if (logDateFilter === 'month') cutoff = subMonths(now, 1);
      result = result.filter(l => new Date(l.created_at) >= cutoff);
    }

    if (logSearch) {
      const search = logSearch.toLowerCase();
      result = result.filter(l =>
        l.description?.toLowerCase().includes(search) ||
        l.entity_title?.toLowerCase().includes(search) ||
        l.user?.full_name?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [logs, logUserFilter, logDateFilter, logSearch]);

  const handleExportAuditLog = (period: 'week' | 'month' | 'all') => {
    const now = new Date();
    let cutoff = subMonths(now, 12);
    if (period === 'week') cutoff = subWeeks(now, 1);
    if (period === 'month') cutoff = subMonths(now, 1);

    const data = logs
      .filter(l => new Date(l.created_at) >= cutoff)
      .map(l => ({
        Date: format(new Date(l.created_at), 'yyyy-MM-dd HH:mm'),
        User: l.user?.full_name || 'Unknown',
        Action: l.action_type,
        Entity: l.entity_type || '',
        Title: l.entity_title || '',
        Description: l.description || '',
      }));

    exportToCSV(data, `audit_log_${period}_${format(now, 'yyyyMMdd')}.csv`);
    toast({ title: 'Exported', description: `Audit log exported (${data.length} entries)` });
  };

  const handleAddAnnouncement = () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setAnnouncements(prev => [{
      id: Date.now().toString(),
      title: newTitle,
      message: newMessage,
      date: new Date()
    }, ...prev]);
    setNewTitle('');
    setNewMessage('');
    toast({ title: 'Posted', description: 'Announcement created successfully' });
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-destructive/20 text-destructive',
      manager: 'bg-accent/20 text-accent',
      member: 'bg-success/20 text-success'
    };
    return colors[role] || 'bg-secondary';
  };

  if (authLoading || usersLoading) return <Layout><div className="container mx-auto px-4 py-8 text-center"><p>Loading...</p></div></Layout>;
  if (!isAdmin) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-accent" /> Admin Panel
          </h1>
          <p className="text-muted-foreground">System administration, user management, and oversight.</p>
        </div>

        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="stats" className="gap-2"><BarChart3 className="w-4 h-4" /> Stats</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
            <TabsTrigger value="audit" className="gap-2"><FileText className="w-4 h-4" /> Audit Log</TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2"><Bell className="w-4 h-4" /> Announcements</TabsTrigger>
            <TabsTrigger value="oversight" className="gap-2"><ClipboardCheck className="w-4 h-4" /> Oversight</TabsTrigger>
            <TabsTrigger value="data" className="gap-2"><Database className="w-4 h-4" /> Data</TabsTrigger>
          </TabsList>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-accent" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      <p className="text-xs text-muted-foreground">Total Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-success" />
                    <div>
                      <p className="text-2xl font-bold">{stats.completionRate}%</p>
                      <p className="text-xs text-muted-foreground">Task Completion</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-info" />
                    <div>
                      <p className="text-2xl font-bold">{stats.completedTasks}</p>
                      <p className="text-xs text-muted-foreground">Completed Tasks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-warning" />
                    <div>
                      <p className="text-2xl font-bold">{stats.inReview}</p>
                      <p className="text-xs text-muted-foreground">Pending Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> User Management</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((userItem) => {
                    const isSelf = userItem.id === user?.id;
                    return (
                      <div key={userItem.id} className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={userItem.avatar_url || undefined} />
                            <AvatarFallback>{userItem.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{userItem.full_name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                            <p className="text-sm text-muted-foreground">{userItem.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {userItem.roles.map(role => <Badge key={role} className={cn("capitalize", getRoleColor(role))}>{role}</Badge>)}
                          <div className="flex gap-1 ml-4">
                            {!userItem.roles.includes('admin') && (
                              <Button variant="outline" size="sm" onClick={() => updateUserRole(userItem.id, 'admin', true)}>Make Admin</Button>
                            )}
                            {!userItem.roles.includes('manager') && !userItem.roles.includes('admin') && (
                              <Button variant="outline" size="sm" onClick={() => updateUserRole(userItem.id, 'manager', true)}>Make Manager</Button>
                            )}
                            {userItem.roles.includes('admin') && !isSelf && (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => updateUserRole(userItem.id, 'admin', false)}>
                                <UserMinus className="w-4 h-4 mr-1" /> Remove Admin
                              </Button>
                            )}
                            {userItem.roles.includes('manager') && (
                              <Button variant="ghost" size="sm" className="text-warning" onClick={() => updateUserRole(userItem.id, 'manager', false)}>
                                <UserMinus className="w-4 h-4 mr-1" /> Remove Manager
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Activity Audit Log</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleExportAuditLog('week')}>
                      <Download className="w-4 h-4 mr-1" /> Weekly
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportAuditLog('month')}>
                      <Download className="w-4 h-4 mr-1" /> Monthly
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportAuditLog('all')}>
                      <Download className="w-4 h-4 mr-1" /> All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={logUserFilter} onValueChange={setLogUserFilter}>
                      <SelectTrigger className="w-40"><SelectValue placeholder="Filter by user" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={logDateFilter} onValueChange={setLogDateFilter}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Time" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{filteredLogs.length} entries</p>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredLogs.slice(0, 100).map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-[10px]">{log.user?.full_name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.user?.full_name || 'System'}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM d, HH:mm')}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{log.description || log.action_type}</p>
                          {log.entity_title && <Badge variant="outline" className="mt-1 text-xs">{log.entity_title}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Post Announcement</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Announcement title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Write your announcement..." rows={4} />
                  </div>
                  <Button onClick={handleAddAnnouncement} className="w-full">Post Announcement</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recent Announcements</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {announcements.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No announcements yet</p>
                    ) : (
                      <div className="space-y-3">
                        {announcements.map(a => (
                          <div key={a.id} className="p-4 rounded-lg border">
                            <h4 className="font-medium">{a.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(a.date, { addSuffix: true })}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Oversight Tab */}
          <TabsContent value="oversight">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader><CardTitle>All Projects</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {projects.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">{p.status}</Badge>
                              <span className="text-xs text-muted-foreground">{p.progress}%</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/projects?highlight=${p.id}`)}>View</Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Tasks in Review</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {tasks.filter(t => t.status === 'review').map(t => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{t.title}</p>
                            <p className="text-xs text-muted-foreground">Assigned: {t.assignee?.full_name || 'Unknown'}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/tasks?highlight=${t.id}`)}>Review</Button>
                        </div>
                      ))}
                      {tasks.filter(t => t.status === 'review').length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No tasks in review</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Action Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {actions.filter((action) => action.status === 'pending').map((action) => (
                        <div key={action.id} className="p-3 rounded-lg border">
                          <p className="font-medium capitalize">{action.action_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">Entity: {action.entity_type}</p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const { error } = await approveAction(action);
                                if (error) {
                                  toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
                                  return;
                                }
                                toast({ title: 'Approved', description: 'Action approved and executed.' });
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const { error } = await rejectAction(action.id);
                                if (error) {
                                  toast({ title: 'Reject failed', description: error.message, variant: 'destructive' });
                                  return;
                                }
                                toast({ title: 'Rejected', description: 'Action request rejected.' });
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                      {actions.filter((action) => action.status === 'pending').length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No pending action approvals</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Data Management</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-2 border-dashed">
                    <CardContent className="p-6 text-center">
                      <Download className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <h4 className="font-medium mb-2">Export All Data</h4>
                      <p className="text-xs text-muted-foreground mb-4">Download complete system backup</p>
                      <Button variant="outline" size="sm" onClick={() => {
                        exportToCSV(tasks.map(t => ({
                          id: t.id, title: t.title, status: t.status,
                          priority: t.priority, assignee: t.assignee?.full_name
                        })), 'all_tasks_export.csv');
                        toast({ title: 'Exported', description: 'Tasks exported successfully' });
                      }}>
                        Export Tasks
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-dashed">
                    <CardContent className="p-6 text-center">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <h4 className="font-medium mb-2">Archive Completed</h4>
                      <p className="text-xs text-muted-foreground mb-4">Archive completed projects</p>
                      <p className="text-sm text-muted-foreground">{projects.filter(p => p.status === 'completed').length} completed projects</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-dashed border-destructive/30">
                    <CardContent className="p-6 text-center">
                      <Trash2 className="w-8 h-8 mx-auto mb-2 text-destructive/50" />
                      <h4 className="font-medium mb-2 text-destructive">Clear Old Logs</h4>
                      <p className="text-xs text-muted-foreground mb-4">Remove activity logs older than 90 days</p>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                        Clear Logs
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout >
  );
};

export default Admin;
