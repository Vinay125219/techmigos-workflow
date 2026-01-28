import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTasks } from '@/hooks/useTasks';
import { Trophy, Sparkles, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function RecentCompletions() {
    const { tasks } = useTasks();
    const router = useRouter();
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const recentCompletions = tasks
        .filter(t => t.status === 'completed' && t.assigned_to)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);

    const goToNext = useCallback(() => {
        if (recentCompletions.length <= 1) return;
        setIsAnimating(true);
        setTimeout(() => {
            setActiveIndex(prev => (prev + 1) % recentCompletions.length);
            setTimeout(() => setIsAnimating(false), 50);
        }, 300);
    }, [recentCompletions.length]);

    useEffect(() => {
        if (recentCompletions.length > 1) {
            const timer = setInterval(goToNext, 4000);
            return () => clearInterval(timer);
        }
    }, [recentCompletions.length, goToNext]);

    if (recentCompletions.length === 0) return null;

    const current = recentCompletions[activeIndex];

    return (
        <div className="mb-6">
            {/* Compact Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                    <Trophy className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Recent Achievements</h3>
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            </div>

            {/* Compact Achievement Card with Upward Fade */}
            <div className="relative overflow-hidden h-[72px]">
                <div
                    onClick={() => router.push(`/my-dashboard/${current.id}`)}
                    className={cn(
                        "absolute inset-0 group cursor-pointer rounded-xl overflow-hidden",
                        "bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50",
                        "dark:from-amber-950/20 dark:via-orange-950/20 dark:to-rose-950/20",
                        "border border-amber-200/60 dark:border-amber-800/30",
                        "shadow-sm hover:shadow-md hover:-translate-y-0.5",
                        "transition-all duration-300",
                        // Upward fade animation
                        isAnimating ? "opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
                    )}
                    style={{ transition: 'opacity 300ms ease-out, transform 300ms ease-out' }}
                >
                    <div className="relative p-3 flex items-center gap-3 h-full">
                        {/* Compact Award Icon */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-sm flex-shrink-0">
                            <Award className="w-6 h-6 text-white" />
                            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">
                                ✓
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                                    {formatDistanceToNow(new Date(current.updated_at), { addSuffix: true })}
                                </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                {current.assignee?.full_name || 'Team Member'}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                Completed: <span className="font-medium">{current.title}</span>
                            </p>
                        </div>

                        {/* Arrow */}
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Minimal Dot Indicators */}
            {recentCompletions.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                    {recentCompletions.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setIsAnimating(true);
                                setTimeout(() => {
                                    setActiveIndex(idx);
                                    setTimeout(() => setIsAnimating(false), 50);
                                }, 300);
                            }}
                            className={cn(
                                "transition-all duration-200 rounded-full",
                                idx === activeIndex
                                    ? "w-4 h-1.5 bg-gradient-to-r from-amber-400 to-orange-400"
                                    : "w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-amber-300"
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
