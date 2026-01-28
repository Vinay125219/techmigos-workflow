import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'info';
  className?: string;
  onClick?: () => void;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  onClick
}: StatsCardProps) {
  const variantStyles = {
    default: 'bg-gradient-to-br from-card to-secondary/30 hover:from-secondary/50 hover:to-card',
    accent: 'bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border-accent/30 hover:border-accent/50',
    success: 'bg-gradient-to-br from-success/20 via-success/10 to-transparent border-success/30 hover:border-success/50',
    warning: 'bg-gradient-to-br from-warning/20 via-warning/10 to-transparent border-warning/30 hover:border-warning/50',
    info: 'bg-gradient-to-br from-info/20 via-info/10 to-transparent border-info/30 hover:border-info/50',
  };

  const iconWrapperStyles = {
    default: 'bg-gradient-to-br from-secondary to-muted',
    accent: 'bg-gradient-to-br from-accent to-accent/70 shadow-lg shadow-accent/25',
    success: 'bg-gradient-to-br from-success to-success/70 shadow-lg shadow-success/25',
    warning: 'bg-gradient-to-br from-warning to-warning/70 shadow-lg shadow-warning/25',
    info: 'bg-gradient-to-br from-info to-info/70 shadow-lg shadow-info/25',
  };

  const iconColorStyles = {
    default: 'text-foreground',
    accent: 'text-white',
    success: 'text-white',
    warning: 'text-white',
    info: 'text-white',
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group",
        onClick && "cursor-pointer",
        variantStyles[variant],
        className
      )}
      onClick={onClick}
    >
      {/* Decorative background blur */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{
          background: variant === 'accent' ? 'hsl(217 91% 60%)' :
            variant === 'success' ? 'hsl(142 71% 45%)' :
              variant === 'warning' ? 'hsl(38 92% 50%)' :
                variant === 'info' ? 'hsl(199 89% 48%)' : 'hsl(222 47% 11%)'
        }} />

      <CardContent className="p-4 sm:p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1 sm:space-y-2">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs sm:text-sm font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              </div>
            )}
          </div>
          <div className={cn(
            "p-2.5 sm:p-3 rounded-xl transition-transform group-hover:scale-110 shrink-0",
            iconWrapperStyles[variant]
          )}>
            <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", iconColorStyles[variant])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
