"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    FolderKanban,
    ListTodo,
    BarChart3,
    Rocket,
    Search,
    ChevronRight,
    Shield,
    Crown,
    User,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MOCK_USERS } from './DemoData';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
    { path: '#', label: 'Dashboard', icon: LayoutDashboard },
    { path: '#', label: 'Projects', icon: FolderKanban },
    { path: '#', label: 'Tasks', icon: ListTodo },
    { path: '#', label: 'Analytics', icon: BarChart3 },
];

export function DemoSidebar() {
    const router = useRouter();
    // Simulate being the Manager "Bob"
    const user = MOCK_USERS[1];

    return (
        <aside className="fixed left-0 top-0 z-50 h-screen w-20 hover:w-64 bg-sidebar-background/95 backdrop-blur-xl border-r border-sidebar-border/50 flex flex-col transition-all duration-300 ease-in-out group shadow-2xl">
            {/* Header / Logo */}
            <div className="p-4 flex items-center h-20 shrink-0">
                <div className="flex items-center gap-3 w-full overflow-hidden">
                    <div className="w-10 h-10 min-w-10 min-h-10 rounded-xl bg-gradient-to-br from-accent to-info flex items-center justify-center shadow-lg shadow-accent/20 shrink-0 ring-1 ring-white/10">
                        <Rocket className="w-5 h-5 text-white" />
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                        <h1 className="font-bold text-lg leading-none tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">TechMigos</h1>
                        <p className="text-xs text-muted-foreground font-medium">ProTask Demo</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 mb-4 shrink-0">
                <div className="relative flex items-center h-10 group/search cursor-pointer">
                    <Search className="absolute left-3 w-4 h-4 text-muted-foreground z-10 group-hover/search:text-accent transition-colors" />
                    <Input
                        placeholder="Search..."
                        className="pl-9 bg-secondary/50 border-transparent focus:bg-background transition-all rounded-xl h-10 w-full opacity-0 group-hover:opacity-100 pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-secondary/50 rounded-xl group-hover:hidden" />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden no-scrollbar">
                {navItems.map((item) => (
                    <div
                        key={item.label}
                        className={cn(
                            "relative flex items-center h-10 px-3 rounded-lg transition-all duration-200 group/item cursor-pointer hover:bg-secondary hover:text-foreground text-muted-foreground",
                            item.label === 'Tasks' && "bg-accent/15 text-accent-foreground font-medium"
                        )}
                    >
                        <item.icon className={cn("w-5 h-5 min-w-5 min-h-5 shrink-0", item.label === 'Tasks' ? "text-accent-foreground" : "")} />
                        <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 delay-75">
                            {item.label}
                        </span>
                    </div>
                ))}
            </nav>

            {/* Footer / User Profile */}
            <div className="p-4 border-t border-sidebar-border mt-auto bg-sidebar-background shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 cursor-pointer transition-colors group/profile overflow-hidden relative">
                            <Avatar className="w-9 h-9 border border-border shrink-0">
                                <AvatarImage src={user.avatar_url} />
                                <AvatarFallback>B</AvatarFallback>
                            </Avatar>
                            <div className="absolute bottom-2 left-8 w-2.5 h-2.5 bg-success border-2 border-sidebar-background rounded-full z-10" />
                            <div className="flex-1 min-w-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <p className="text-sm font-semibold truncate leading-tight text-foreground">{user.full_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-accent/10 text-accent border-accent/20 gap-0.5"><Crown className="w-3 h-3" /> Manager</Badge>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="end" sideOffset={20} className="w-56 ml-4">
                        <DropdownMenuLabel>Demo Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/')} className="text-destructive">
                            <LogOut className="w-4 h-4 mr-2" />
                            Exit Demo
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </aside>
    );
}
