import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useActivityLogs } from '@/hooks/useActivityLogs';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Loader2, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RecentActivityWidget() {
    const router = useRouter();
    const { logs, loading, getActivityIcon, getActivityColor } = useActivityLogs(25);

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="w-5 h-5 text-accent" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full overflow-hidden">
            <CardHeader className="pb-2 border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-accent to-info">
                            <Activity className="w-4 h-4 text-white" />
                        </div>
                        Recent Activity
                        {logs.length > 0 && (
                            <Badge variant="secondary" className="ml-2 font-normal text-xs">
                                {logs.length}
                            </Badge>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/analytics')}
                        className="text-xs text-muted-foreground hover:text-primary"
                    >
                        <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                        View All
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[320px]">
                    {logs.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">
                            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No recent activity</p>
                            <p className="text-xs mt-1">Activity will appear here as you work</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {logs.map((log, index) => {
                                const handleActivityClick = () => {
                                    if (log.entity_type && log.entity_id) {
                                        const highlightId = log.entity_id;
                                        let path = '';

                                        switch (log.entity_type) {
                                            case 'project':
                                                path = `/projects?highlight=${highlightId}`;
                                                break;
                                            case 'task':
                                                path = `/tasks?highlight=${highlightId}`;
                                                break;
                                            case 'idea':
                                                path = `/ideas?highlight=${highlightId}`;
                                                break;
                                            default:
                                                return;
                                        }

                                        router.push(path);

                                        // Highlight after navigation
                                        setTimeout(() => {
                                            const element = document.querySelector(`[data-entity-id="${highlightId}"]`);
                                            if (element) {
                                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                element.classList.add('highlight-glow');
                                                setTimeout(() => {
                                                    element.classList.remove('highlight-glow');
                                                }, 3000);
                                            }
                                        }, 300);
                                    }
                                };

                                return (
                                    <div
                                        key={log.id}
                                        onClick={handleActivityClick}
                                        className={cn(
                                            "group px-4 py-3 hover:bg-muted/50 transition-all duration-200 cursor-pointer",
                                            "border-l-2 border-transparent hover:border-accent",
                                            log.entity_type && log.entity_id && "hover:bg-accent/5"
                                        )}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* User Avatar */}
                                            <div className="relative flex-shrink-0">
                                                <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                                                    <AvatarImage src={log.user?.avatar_url || undefined} />
                                                    <AvatarFallback className="text-xs bg-gradient-to-br from-accent to-primary text-white">
                                                        {log.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {/* Activity Icon Badge */}
                                                <div className={cn(
                                                    "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]",
                                                    "bg-white dark:bg-card border border-border shadow-sm"
                                                )}>
                                                    {getActivityIcon(log.action_type)}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-semibold text-foreground truncate">
                                                        {log.user?.full_name || 'Unknown User'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                    {log.description || log.action_type.replace(/_/g, ' ')}
                                                </p>
                                                {log.entity_title && (
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] px-1.5 py-0 h-4 font-normal",
                                                                getActivityColor(log.action_type)
                                                            )}
                                                        >
                                                            {log.entity_type}
                                                        </Badge>
                                                        <span className="text-xs text-foreground/80 truncate max-w-[180px] hover:text-accent transition-colors">
                                                            {log.entity_title}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Arrow on hover */}
                                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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
