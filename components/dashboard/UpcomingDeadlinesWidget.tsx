import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import type { Task } from '@/types/database';

export function UpcomingDeadlinesWidget() {
    const router = useRouter();
    const { tasks, loading } = useTasks();
    const { user } = useAuth();

    // Get tasks with upcoming deadlines (within 14 days), sorted by deadline
    const upcomingTasks = useMemo(() => {
        const now = new Date();

        return tasks
            .filter(task => {
                if (!task.deadline) return false;
                if (task.status === 'completed') return false;

                const deadline = new Date(task.deadline);
                const daysUntil = differenceInDays(deadline, now);
                return daysUntil <= 14 && daysUntil >= -7; // Include overdue up to 7 days
            })
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
            .slice(0, 8);
    }, [tasks]);

    const getDeadlineStatus = (deadline: string) => {
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const daysUntil = differenceInDays(deadlineDate, now);

        if (daysUntil < 0) {
            return { label: 'Overdue', color: 'bg-destructive text-destructive-foreground', urgent: true };
        }
        if (daysUntil === 0) {
            return { label: 'Due Today', color: 'bg-warning text-warning-foreground', urgent: true };
        }
        if (daysUntil <= 3) {
            return { label: `${daysUntil}d left`, color: 'bg-warning/20 text-warning', urgent: true };
        }
        if (daysUntil <= 7) {
            return { label: `${daysUntil}d left`, color: 'bg-info/20 text-info', urgent: false };
        }
        return { label: `${daysUntil}d left`, color: 'bg-secondary text-secondary-foreground', urgent: false };
    };

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-warning to-orange-400">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        Upcoming Deadlines
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/tasks')}
                        className="text-xs"
                    >
                        View All <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px]">
                    {loading ? (
                        <div className="p-6 text-center text-muted-foreground">
                            <Clock className="w-6 h-6 mx-auto mb-2 animate-spin" />
                            <p className="text-sm">Loading...</p>
                        </div>
                    ) : upcomingTasks.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No upcoming deadlines</p>
                            <p className="text-xs mt-1">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {upcomingTasks.map((task) => {
                                const status = getDeadlineStatus(task.deadline!);
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => router.push(`/tasks?highlight=${task.id}`)}
                                        className={cn(
                                            "px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
                                            "border-l-2",
                                            status.urgent ? "border-l-warning" : "border-l-transparent"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {status.urgent && (
                                                        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                                                    )}
                                                    <p className="text-sm font-medium line-clamp-1">
                                                        {task.title}
                                                    </p>
                                                </div>
                                                {task.project && (
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                        📁 {task.project.name}
                                                    </p>
                                                )}
                                                <p className="text-xs text-muted-foreground/70 mt-1">
                                                    {format(new Date(task.deadline!), 'MMM d, yyyy')}
                                                </p>
                                            </div>
                                            <Badge className={cn("shrink-0 text-xs", status.color)}>
                                                {status.label}
                                            </Badge>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
