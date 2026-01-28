import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ProgressOverviewProps {
  completed: number;
  inProgress: number;
  upcoming: number;
  totalProgress: number;
}

export function ProgressOverview({ completed, inProgress, upcoming, totalProgress }: ProgressOverviewProps) {
  const total = completed + inProgress + upcoming;
  // Fallback to 1 to avoid division by zero in calculations if no tasks
  const safeTotal = total || 1;

  return (
    <Card className="card-hover overflow-hidden relative border-accent/10">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <span className="text-lg">📊</span>
          </div>
          Overall Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8 relative z-10">
        {/* Main progress bar */}
        <div className="space-y-3">
          <div className="flex items-end justify-between text-sm">
            <span className="font-medium text-muted-foreground">Project Completion</span>
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-3xl gradient-text animate-in zoom-in duration-500">{totalProgress}</span>
              <span className="text-muted-foreground font-medium">%</span>
            </div>
          </div>
          <div className="h-4 rounded-full bg-secondary/50 overflow-hidden shadow-inner ring-1 ring-black/5 dark:ring-white/5">
            <div
              className="h-full rounded-full animate-progress relative overflow-hidden"
              style={{
                width: `${totalProgress}%`,
                background: 'var(--gradient-primary)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
              }}
            >
              <div className="absolute inset-0 bg-white/20 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            </div>
          </div>
        </div>

        {/* Task breakdown */}
        <div className="space-y-5">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/30 border border-border/50">
            <div
              className="h-10 rounded-lg bg-gradient-to-r from-success to-emerald-400 transition-all duration-700 ease-out hover:opacity-90 relative group"
              style={{ width: `${(completed / safeTotal) * 100}%` }}
              title={`${completed} Completed`}
            >
              {(completed / safeTotal) > 0.1 && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round((completed / safeTotal) * 100)}%
                </div>
              )}
            </div>
            <div
              className="h-10 rounded-lg bg-gradient-to-r from-info to-blue-400 transition-all duration-700 ease-out hover:opacity-90 relative group"
              style={{ width: `${(inProgress / safeTotal) * 100}%` }}
              title={`${inProgress} In Progress`}
            >
              {(inProgress / safeTotal) > 0.1 && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round((inProgress / safeTotal) * 100)}%
                </div>
              )}
            </div>
            <div
              className="h-10 rounded-lg bg-secondary transition-all duration-700 ease-out hover:bg-secondary/80 relative group"
              style={{ width: `${(upcoming / safeTotal) * 100}%` }}
              title={`${upcoming} Upcoming`}
            >
              {(upcoming / safeTotal) > 0.1 && (
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {Math.round((upcoming / safeTotal) * 100)}%
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center p-3 rounded-xl bg-success/5 border border-success/10 hover:border-success/30 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Done</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-success">{completed}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-info/5 border border-info/10 hover:border-info/30 transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-info shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-info">{inProgress}</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-secondary/50 border border-border/50 hover:border-border transition-colors">
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Todo</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground/80">{upcoming}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
