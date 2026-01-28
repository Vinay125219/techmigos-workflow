import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, ClipboardCheck, Clock, TrendingUp, Target,
    CheckCircle2, AlertTriangle, ArrowRight, Eye
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const ManagerDashboard = () => {
    const router = useRouter();
    const { isManager, loading: authLoading } = useAuth();
    const { tasks, approveTask, rejectTask } = useTasks();
    const { projects } = useProjects();
    const { members } = useTeamMembers();

    useEffect(() => {
        if (!authLoading && !isManager) router.push('/');
    }, [isManager, authLoading, router]);

    // Tasks pending review
    const pendingReview = useMemo(() =>
        tasks.filter(t => t.status === 'review'), [tasks]
    );

    // Team workload
    const teamWorkload = useMemo(() => {
        return members.map(member => {
            const memberTasks = tasks.filter(t => t.assigned_to === member.id);
            const completed = memberTasks.filter(t => t.status === 'completed').length;
            const inProgress = memberTasks.filter(t => t.status === 'in-progress').length;
            const review = memberTasks.filter(t => t.status === 'review').length;
            return {
                ...member,
                totalTasks: memberTasks.length,
                completed,
                inProgress,
                review,
                completionRate: memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0
            };
        }).sort((a, b) => b.totalTasks - a.totalTasks);
    }, [members, tasks]);

    // Project stats
    const projectStats = useMemo(() => ({
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        atRisk: projects.filter(p => p.progress < 30 && p.status === 'active').length,
    }), [projects]);

    // Task stats
    const taskStats = useMemo(() => ({
        total: tasks.length,
        open: tasks.filter(t => t.status === 'open').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        pendingReview: pendingReview.length,
        completed: tasks.filter(t => t.status === 'completed').length,
    }), [tasks, pendingReview]);

    const handleApprove = async (taskId: string) => {
        try {
            await approveTask(taskId);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const handleReject = async (taskId: string) => {
        try {
            await rejectTask(taskId);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    if (authLoading) return <Layout><div className="container mx-auto px-4 py-8 text-center"><p>Loading...</p></div></Layout>;
    if (!isManager) return null;

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <ClipboardCheck className="w-8 h-8 text-accent" />
                        Manager Dashboard
                    </h1>
                    <p className="text-muted-foreground">Oversee team progress, review submissions, and manage workload.</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="card-hover cursor-pointer" onClick={() => router.push('/tasks?status=review')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-warning/20">
                                    <Eye className="w-5 h-5 text-warning" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{taskStats.pendingReview}</p>
                                    <p className="text-xs text-muted-foreground">Pending Review</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="card-hover cursor-pointer" onClick={() => router.push('/tasks?status=in-progress')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-accent/20">
                                    <Clock className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{taskStats.inProgress}</p>
                                    <p className="text-xs text-muted-foreground">In Progress</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="card-hover cursor-pointer" onClick={() => router.push('/tasks?status=open')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-info/20">
                                    <Target className="w-5 h-5 text-info" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{taskStats.open}</p>
                                    <p className="text-xs text-muted-foreground">Open Tasks</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="card-hover cursor-pointer" onClick={() => router.push('/projects')}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-success/20">
                                    <TrendingUp className="w-5 h-5 text-success" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{projectStats.active}</p>
                                    <p className="text-xs text-muted-foreground">Active Projects</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Pending Review */}
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-warning" />
                                    Tasks Pending Review ({pendingReview.length})
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => router.push('/tasks?status=review')}>
                                    View All <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                {pendingReview.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                        <p>No tasks pending review</p>
                                        <p className="text-xs mt-1">All caught up! 🎉</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {pendingReview.slice(0, 10).map((task) => (
                                            <div
                                                key={task.id}
                                                className="p-4 rounded-lg border hover:border-accent/50 transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium line-clamp-1">{task.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {task.assignee && (
                                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                    <Avatar className="w-4 h-4">
                                                                        <AvatarImage src={task.assignee.avatar_url || undefined} />
                                                                        <AvatarFallback className="text-[8px]">
                                                                            {task.assignee.full_name?.charAt(0) || 'U'}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    {task.assignee.full_name}
                                                                </div>
                                                            )}
                                                            <span className="text-xs text-muted-foreground">
                                                                • {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <Badge variant="outline" className="mt-2 text-xs">{task.project?.name || 'No project'}</Badge>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-warning border-warning hover:bg-warning/10"
                                                            onClick={() => handleReject(task.id)}
                                                        >
                                                            Request Changes
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="bg-success hover:bg-success/90"
                                                            onClick={() => handleApprove(task.id)}
                                                        >
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            Approve
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Team Workload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-accent" />
                                Team Workload
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px]">
                                {teamWorkload.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No team members</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {teamWorkload.map((member) => (
                                            <div key={member.id} className="p-3 rounded-lg border">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarImage src={member.avatar_url || undefined} />
                                                        <AvatarFallback className="text-xs">
                                                            {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{member.full_name}</p>
                                                        <p className="text-xs text-muted-foreground">{member.totalTasks} tasks</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Progress value={member.completionRate} className="flex-1 h-1.5" />
                                                    <span className="text-xs font-medium w-10 text-right">{member.completionRate}%</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {member.inProgress} active
                                                    </Badge>
                                                    {member.review > 0 && (
                                                        <Badge className="text-[10px] bg-warning/20 text-warning">
                                                            {member.review} in review
                                                        </Badge>
                                                    )}
                                                    <Badge className="text-[10px] bg-success/20 text-success">
                                                        {member.completed} done
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
};

export default ManagerDashboard;
