import { HelpCircle, Book, MessageCircle, Rocket, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/useOnboarding';

export function HelpMenu() {
  const { restartOnboarding } = useOnboarding();

  const helpItems = [
    {
      icon: Rocket,
      label: 'Getting Started Tour',
      description: 'Take a guided tour of the platform',
      action: restartOnboarding,
    },
    {
      icon: Book,
      label: 'Documentation',
      description: 'Learn how to use TechMigos ProTask',
      action: () => window.open('https://www.techmigos.com', '_blank'),
    },
    {
      icon: MessageCircle,
      label: 'Contact Support',
      description: 'Get help from our team',
      action: () => { },
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Help & Resources</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {helpItems.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.action}
            className="flex items-start gap-3 py-3 cursor-pointer"
          >
            <div className="p-1.5 rounded-lg bg-accent/10">
              <item.icon className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
