"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    BarChart3,
    Rocket,
    Settings,
    LogOut,
    Search,
    ClipboardCheck,
    Lightbulb,
    FileText,
    BookOpen,
    Shield,
    Crown,
    User,
    Menu,
    Building2,
    Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/workspaces', label: 'Workspaces', icon: Building2 },
    { path: '/projects', label: 'Projects', icon: FolderKanban },
    { path: '/tasks', label: 'Tasks', icon: ListTodo },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/ideas', label: 'Ideas', icon: Lightbulb },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/planning', label: 'Planning', icon: Rocket },
];

const managerNavItem = { path: '/manager', label: 'Manager', icon: ClipboardCheck };

export function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, isManager, isAdmin, signOut } = useAuth();
    const [open, setOpen] = useState(false);

    const allNavItems = isManager
        ? [...navItems, { path: '/transactions', label: 'Transactions', icon: Wallet }, managerNavItem]
        : navItems;

    const getRoleBadge = () => {
        if (isAdmin) return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-0.5"><Shield className="w-3 h-3" /> Admin</Badge>;
        if (isManager) return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-accent/10 text-accent border-accent/20 gap-0.5"><Crown className="w-3 h-3" /> Manager</Badge>;
        return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-secondary text-muted-foreground border-border gap-0.5"><User className="w-3 h-3" /> Dev</Badge>;
    };

    const handleSignOut = async () => {
        await signOut();
        setOpen(false);
        router.push('/');
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-5 h-5" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-[300px] p-0 border-r border-border/50 bg-sidebar-background/95 backdrop-blur-xl">
                <SheetHeader className="p-4 border-b border-border/50 text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-info flex items-center justify-center shadow-lg shadow-accent/20 shrink-0">
                            <Rocket className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <SheetTitle className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                                TechMigos
                            </SheetTitle>
                            <p className="text-xs text-muted-foreground font-medium">ProTask</p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex flex-col h-[calc(100vh-5rem)]">
                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                        {allNavItems.map((item) => {
                            const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                                        isActive
                                            ? "bg-accent/15 text-accent-foreground font-medium"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                    )}
                                >
                                    <Icon className={cn(
                                        "w-5 h-5",
                                        isActive ? "text-accent-foreground" : "text-muted-foreground"
                                    )} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer / Profile */}
                    <div className="p-4 border-t border-border/50 bg-secondary/10 mt-auto">
                        {user && profile ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                                    <Avatar className="w-9 h-9 border border-border">
                                        <AvatarImage src={profile.avatar_url || undefined} />
                                        <AvatarFallback className="bg-primary/5 text-primary text-xs">
                                            {profile.full_name?.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate text-foreground">
                                            {profile.full_name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {getRoleBadge()}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </Button>
                            </div>
                        ) : (
                            <Button
                                className="w-full"
                                onClick={() => {
                                    setOpen(false);
                                    router.push('/auth');
                                }}
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign In
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
