import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  BarChart3,
  Rocket,
  Menu,
  X,
  Lightbulb,
  Sparkles,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/auth/UserMenu';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { useAuth } from '@/contexts/AuthContext';
import { HelpMenu } from '@/components/help/HelpMenu';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const baseNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-cyan-400' },
  { path: '/projects', label: 'Projects', icon: FolderKanban, color: 'from-purple-500 to-pink-400' },
  { path: '/tasks', label: 'Tasks', icon: ListTodo, color: 'from-orange-500 to-amber-400' },
  { path: '/ideas', label: 'Ideas', icon: Lightbulb, color: 'from-yellow-500 to-orange-400' },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, color: 'from-indigo-500 to-purple-400' },
  { path: '/planning', label: 'Planning', icon: Rocket, color: 'from-pink-500 to-rose-400' },
];

const managerNavItem = { path: '/manager', label: 'Manager', icon: ClipboardCheck, color: 'from-teal-500 to-emerald-400' };

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, isManager } = useAuth();

  // Build nav items based on role
  const navItems = isManager ? [...baseNavItems, managerNavItem] : baseNavItems;

  // Add scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "sticky top-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-background/80 backdrop-blur-xl border-b shadow-lg shadow-black/5"
        : "bg-background/50 backdrop-blur-md border-b border-transparent"
    )}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo with animation */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-accent to-info rounded-xl blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-accent via-accent/90 to-info shadow-lg shadow-accent/25 group-hover:scale-110 transition-transform">
                <Rocket className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">TechMigos</span>
              <span className="text-muted-foreground text-sm ml-1 font-medium">ProTask</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1 bg-secondary/30 rounded-2xl p-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="relative group"
                >
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
                    isActive
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                    {/* Active background */}
                    {isActive && (
                      <div className={cn(
                        "absolute inset-0 rounded-xl bg-gradient-to-r shadow-lg",
                        item.color
                      )} style={{ boxShadow: '0 4px 15px -3px rgba(0,0,0,0.2)' }} />
                    )}
                    {/* Hover background */}
                    <div className={cn(
                      "absolute inset-0 rounded-xl bg-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity",
                      isActive && "hidden"
                    )} />
                    <Icon className={cn("w-4 h-4 relative z-10 transition-transform group-hover:scale-110", isActive && "text-white")} />
                    <span className="relative z-10">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <HelpMenu />
            {isAuthenticated && <NotificationPanel />}
            <UserMenu />

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden relative overflow-hidden group"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-info/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
              {isMobileMenuOpen ? <X className="w-5 h-5 relative z-10" /> : <Menu className="w-5 h-5 relative z-10" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation - Enhanced */}
        <div className={cn(
          "lg:hidden overflow-hidden transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "max-h-[500px] opacity-100 pb-4" : "max-h-0 opacity-0"
        )}>
          <div className="pt-4 border-t border-border/50">
            <div className="flex flex-col gap-1">
              {navItems.map((item, index) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
                      isActive
                        ? "text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: isMobileMenuOpen ? 'slideUp 0.3s ease-out forwards' : 'none'
                    }}
                  >
                    {/* Active/Hover background */}
                    <div className={cn(
                      "absolute inset-0 rounded-xl transition-all duration-300",
                      isActive
                        ? `bg-gradient-to-r ${item.color} shadow-lg`
                        : "bg-secondary/50 opacity-0 group-hover:opacity-100"
                    )} />

                    {/* Icon with glow */}
                    <div className={cn(
                      "relative z-10 p-2 rounded-lg transition-all",
                      isActive
                        ? "bg-white/20"
                        : "bg-secondary group-hover:bg-secondary/80"
                    )}>
                      <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-foreground")} />
                    </div>

                    <span className="relative z-10 flex-1">{item.label}</span>

                    <ChevronRight className={cn(
                      "w-4 h-4 relative z-10 transition-transform",
                      isActive ? "text-white/70" : "text-muted-foreground",
                      "group-hover:translate-x-1"
                    )} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
