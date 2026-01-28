import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TimelineItem {
  label: string;
  count: number;
  period: 'past' | 'present' | 'future';
}

interface TimelineIndicatorProps {
  items: TimelineItem[];
}

export function TimelineIndicator({ items }: TimelineIndicatorProps) {
  const getPeriodStyles = (period: TimelineItem['period']) => {
    switch (period) {
      case 'past':
        return 'bg-muted-foreground/20 text-muted-foreground';
      case 'present':
        return 'bg-accent text-accent-foreground';
      case 'future':
        return 'bg-secondary text-secondary-foreground border-2 border-dashed border-accent/50';
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-lg">Work Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {items.map((item, index) => (
            <div key={item.period} className="flex-1 relative">
              <div 
                className={cn(
                  "p-4 rounded-xl text-center transition-all duration-300",
                  getPeriodStyles(item.period),
                  item.period === 'present' && 'shadow-glow'
                )}
              >
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-xs font-medium mt-1">{item.label}</p>
              </div>
              {index < items.length - 1 && (
                <div className="absolute top-1/2 -right-1 w-2 h-0.5 bg-border z-10" />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 text-xs text-muted-foreground">
          <span>← Past</span>
          <span className="font-medium text-accent">Now</span>
          <span>Future →</span>
        </div>
      </CardContent>
    </Card>
  );
}
