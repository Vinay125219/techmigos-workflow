import { AlertTriangle, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  message: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'urgent':
        return {
          bg: 'bg-destructive/10 border-destructive/20',
          icon: AlertTriangle,
          iconColor: 'text-destructive',
        };
      case 'warning':
        return {
          bg: 'bg-warning/10 border-warning/20',
          icon: Clock,
          iconColor: 'text-warning',
        };
      case 'info':
        return {
          bg: 'bg-info/10 border-info/20',
          icon: Info,
          iconColor: 'text-info',
        };
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Alerts & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, index) => {
          const styles = getAlertStyles(alert.type);
          const Icon = styles.icon;
          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border animate-fade-in",
                styles.bg
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", styles.iconColor)} />
              <p className="text-sm">{alert.message}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
