"use client";

import { useMemo } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Trophy,
    Star,
    Target,
    Flame,
    Medal,
    CalendarDays,
    Briefcase,
    Mail,
    CheckCircle2,
    Clock,
    Shield
} from 'lucide-react';
import type { Profile, Task } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { useTasks } from '@/hooks/useTasks';

interface MemberProfileSheetProps {
    member: Profile | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MemberProfileSheet({ member, open, onOpenChange }: MemberProfileSheetProps) {
    const { tasks } = useTasks();

    const memberStats = useMemo(() => {
        if (!member) return null;

        // Filter tasks for this member
        const memberTasks = tasks.filter(t => t.assigned_to === member.id);
        const completed = memberTasks.filter(t => t.status === 'completed');
        const inProgress = memberTasks.filter(t => t.status === 'in-progress');
        const total = memberTasks.length;

        // Calculate simple efficiency/completion rate
        const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        // Find recent wins (completed tasks)
        const recentWins = [...completed]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 5);

        // Determine badges based on performance
        const badges = [];
        if (completed.length >= 10) badges.push({ icon: Trophy, label: "Task Master", color: "text-yellow-500 bg-yellow-500/10" });
        if (completionRate >= 80 && total >= 5) badges.push({ icon: Star, label: "High Performer", color: "text-purple-500 bg-purple-500/10" });
        if (inProgress.length > 3) badges.push({ icon: Flame, label: "On Fire", color: "text-orange-500 bg-orange-500/10" });
        if (memberTasks.some(t => t.priority === 'critical' && t.status === 'completed')) badges.push({ icon: Shield, label: "Crisis Solver", color: "text-red-500 bg-red-500/10" });

        // "Join date" approximation (using created_at)
        const joinedDate = member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Unknown';
        const joinedAgo = member.created_at ? formatDistanceToNow(new Date(member.created_at), { addSuffix: true }) : '';

        return {
            total,
            completed: completed.length,
            inProgress: inProgress.length,
            completionRate,
            recentWins,
            badges,
            joinedDate,
            joinedAgo
        };
    }, [member, tasks]);

    if (!member || !memberStats) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto w-full">
                <SheetHeader className="text-left space-y-4 pb-6">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="relative mb-4">
                            <Avatar className="w-24 h-24 border-4 border-background shadow-xl ring-2 ring-primary/20">
                                <AvatarImage src={member.avatar_url || ''} alt={member.full_name} className="object-cover" />
                                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                                    {member.full_name?.charAt(0)?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-2 -right-2 bg-background p-1.5 rounded-full shadow-sm border">
                                <Medal className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                            </div>
                        </div>

                        <SheetTitle className="text-2xl font-bold">{member.full_name}</SheetTitle>
                        <SheetDescription className="text-base font-medium text-muted-foreground flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            {member.designation || member.department || 'Team Member'}
                        </SheetDescription>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <CalendarDays className="w-3 h-3" />
                            <span>Joined {memberStats.joinedAgo}</span>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-8">
                    {/* Motivational Stats */}
                    <section>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <Target className="w-5 h-5 text-primary" />
                            Performance Stats
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-secondary/30 p-4 rounded-xl border border-secondary text-center space-y-1">
                                <p className="text-3xl font-bold text-primary">{memberStats.completed}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tasks Done</p>
                            </div>
                            <div className="bg-secondary/30 p-4 rounded-xl border border-secondary text-center space-y-1">
                                <p className="text-3xl font-bold text-primary">{memberStats.completionRate}%</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Completion Rate</p>
                            </div>
                        </div>

                        {memberStats.total > 0 && (
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Efficiency Score</span>
                                    <span>{memberStats.completionRate}/100</span>
                                </div>
                                <Progress value={memberStats.completionRate} className="h-2" />
                            </div>
                        )}
                    </section>

                    {/* Badges */}
                    {memberStats.badges.length > 0 && (
                        <section>
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                <Medal className="w-5 h-5 text-yellow-500" />
                                Achievements
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {memberStats.badges.map((badge, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${badge.color} border border-current/20`}>
                                        <badge.icon className="w-3.5 h-3.5" />
                                        {badge.label}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Recent Wins */}
                    <section>
                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <Trophy className="w-5 h-5 text-orange-500" />
                            Recent Wins
                        </h3>
                        <ScrollArea className="h-[200px] rounded-md border p-4 bg-secondary/10">
                            {memberStats.recentWins.length > 0 ? (
                                <div className="space-y-4">
                                    {memberStats.recentWins.map((task) => (
                                        <div key={task.id} className="flex gap-3 items-start group">
                                            <div className="mt-1">
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors line-clamp-2">
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-4">
                                    <Star className="w-8 h-8 opacity-20 mb-2" />
                                    <p className="text-sm">No recent wins yet.</p>
                                    <p className="text-xs">Cheer them on!</p>
                                </div>
                            )}
                        </ScrollArea>
                    </section>

                    <div className="flex items-center justify-center pt-4">
                        <Button variant="outline" className="gap-2 w-full" onClick={() => window.location.href = `mailto:${member.email}`}>
                            <Mail className="w-4 h-4" />
                            Send Motivation
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
