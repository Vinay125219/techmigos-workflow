"use client";

import { AlertTriangle, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDependencyPlanning } from '@/hooks/useDependencyPlanning';

interface DependencyPlanningPanelProps {
  workspaceId?: string | null;
}

export function DependencyPlanningPanel({ workspaceId }: DependencyPlanningPanelProps) {
  const { blockedAlerts, criticalPath, ganttRows } = useDependencyPlanning(workspaceId);
  const maxDuration = Math.max(1, ...ganttRows.map((row) => row.durationDays));

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-accent" />
          Dependency Planning (Gantt + Critical Path)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-medium mb-3">Blocked Work Alerts</h3>
          {blockedAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocked tasks right now.</p>
          ) : (
            <div className="space-y-2">
              {blockedAlerts.map((entry) => (
                <div key={entry.dependencyId} className="p-3 border rounded-md bg-warning/5">
                  <p className="text-sm">
                    <AlertTriangle className="w-4 h-4 inline mr-1 text-warning" />
                    <span className="font-medium">{entry.task?.title}</span> is blocked by{' '}
                    <span className="font-medium">{entry.blocker?.title}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-medium mb-3">Critical Path</h3>
          {criticalPath.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough dependencies to compute a critical path yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {criticalPath.map((task) => (
                <Badge key={task.id} variant="outline" className="px-3 py-1">
                  {task.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-medium mb-3">Timeline (Gantt-style)</h3>
          <div className="space-y-2">
            {ganttRows.map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                <div className="w-56 text-sm truncate">{row.title}</div>
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 bg-accent"
                    style={{ width: `${Math.max(6, (row.durationDays / maxDuration) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground w-24 text-right">
                  {row.startLabel} → {row.endLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
