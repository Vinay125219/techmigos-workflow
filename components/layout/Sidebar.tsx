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
    ChevronRight,
    Shield,
    Crown,
    User,
    Sparkles,
    Command,
    Building2,
    Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditProfileModal } from '@/components/profile/EditProfileModal';

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

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, isManager, isAdmin, signOut } = useAuth();

    const allNavItems = isManager
        ? [...navItems, { path: '/transactions', label: 'Transactions', icon: Wallet }, managerNavItem]
        : navItems;

    const getRoleBadge = () => {
        if (isAdmin) return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-0.5"><Shield className="w-3 h-3" /> Admin</Badge>;
        if (isManager) return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-accent/10 text-accent border-accent/20 gap-0.5"><Crown className="w-3 h-3" /> Manager</Badge>;
        return <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-secondary text-muted-foreground border-border gap-0.5"><User className="w-3 h-3" /> Developer</Badge>;
    };

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    return (
        <aside className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-20 hover:w-64 bg-sidebar-background/95 backdrop-blur-xl border-r border-sidebar-border/50 flex-col transition-all duration-300 ease-in-out group shadow-2xl">
            {/* Header / Logo */}
            <div className="p-4 flex items-center h-20 shrink-0">
                <div className="flex items-center gap-3 w-full overflow-hidden">
                    <div className="w-10 h-10 min-w-10 min-h-10 rounded-xl bg-gradient-to-br from-accent to-info flex items-center justify-center shadow-lg shadow-accent/20 shrink-0 ring-1 ring-white/10">
                        <Rocket className="w-5 h-5 text-white" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                        <h1 className="font-bold text-lg leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">TechMigos</h1>
                        <p className="text-xs text-muted-foreground font-medium">ProTask</p>
                    </div>
                </div>
            </div>

            {/* Search - Icon only when collapsed, Input when expanded */}
            <div className="px-4 mb-4 shrink-0">
                <div
                    className="relative flex items-center h-10 cursor-pointer group/search"
                    onClick={() => document.dispatchEvent(new Event('openCommandMenu'))}
                >
                    <Search className="absolute left-3 w-4 h-4 text-muted-foreground z-10 group-hover/search:text-accent transition-colors" />
                    <div className="absolute inset-0 bg-secondary/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="pl-9 pr-3 flex items-center justify-between bg-secondary/30 border border-transparent hover:border-accent/20 transition-all rounded-xl h-10 w-full opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="text-sm text-muted-foreground">Search...</span>
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>

                    <div className="absolute inset-0 rounded-xl group-hover:hidden" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                {allNavItems.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={cn(
                                "relative flex items-center h-10 px-3 rounded-lg transition-all duration-200 group/item",
                                isActive
                                    ? "bg-accent/15 text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                            )}
                        >
                            <Icon className={cn(
                                "w-5 h-5 min-w-5 min-h-5 transition-colors shrink-0",
                                isActive ? "text-accent-foreground" : "text-muted-foreground group-hover/item:text-foreground"
                            )} />

                            <span className={cn(
                                "ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75"
                            )}>
                                {item.label}
                            </span>

                            {isActive && (
                                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-4 h-4 text-accent-foreground/50" />
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="p-4 border-t border-sidebar-border mt-auto bg-sidebar-background shrink-0">
                {user && profile ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 cursor-pointer transition-colors group/profile overflow-hidden relative">
                                <Avatar className="w-9 h-9 border border-border shrink-0">
                                    <AvatarImage src={profile.avatar_url || undefined} />
                                    <AvatarFallback className="bg-primary/5 text-primary text-xs">{profile.full_name?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>

                                {/* Online Indicator */}
                                <div className="absolute bottom-2 left-8 w-2.5 h-2.5 bg-success border-2 border-sidebar-background rounded-full z-10" />

                                <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <p className="text-sm font-semibold truncate leading-tight text-foreground">{profile.full_name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {getRoleBadge()}
                                    </div>
                                </div>

                                <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent side="right" align="end" sideOffset={20} className="w-56 ml-4">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                My Dashboard
                            </DropdownMenuItem>
                            {isAdmin && (
                                <DropdownMenuItem onClick={() => router.push('/admin')}>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Admin Panel
                                </DropdownMenuItem>
                            )}

                            {/* Reuse Edit Profile Logic by wrapping layout or using dialog trigger separately if needed. 
                  For now using the modal component structure directly or simplified. 
                  EditProfileModal typically is a button, let's check definition. 
                  It's a Dialog trigger. We need to trigger it programmatically or wrap an item. 
                  Let's use a simpler approach: Render the modal but trigger via state if possible, 
                  or just put the EditProfileModal here if it renders a trigger.
                  EditProfileModal content is complex. I'll import and use it.
                  Adjusting UserMenu strategy: simpler to link to settings/profile page? 
                  User asked for "Edit Profile". I'll insert a placeholder item or the actual modal trigger.
               */}
                            <div className="relative">
                                <EditProfileModal trigger={
                                    <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-secondary">
                                        <User className="w-4 h-4 mr-2" />
                                        Edit Profile
                                    </div>
                                } />
                            </div>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push('/auth')}
                        className="w-full justify-start px-2 gap-3 hover:bg-secondary/50"
                    >
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                            <LogOut className="w-4 h-4 text-accent" />
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap font-medium">
                            Sign In
                        </span>
                    </Button>
                )}
            </div>
        </aside>
    );
}
