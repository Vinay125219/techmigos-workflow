"use client";
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { MobileNav } from './MobileNav';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export function Header() {
    const pathname = usePathname();
    const segments = pathname.split('/').filter(Boolean);

    return (
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50 h-16 flex items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-2">
                {/* Mobile Navigation Trigger */}
                <MobileNav />

                {/* Breadcrumbs (Hidden on very small screens if path is deep, or simplified) */}
                <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                    <Link href="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
                        <Home className="w-3.5 h-3.5" />
                    </Link>
                    {segments.length > 0 && <ChevronRight className="w-4 h-4 mx-1 opacity-50" />}
                    {segments.map((segment, index) => {
                        const isLast = index === segments.length - 1;
                        const href = `/${segments.slice(0, index + 1).join('/')}`;

                        return (
                            <div key={href} className="flex items-center">
                                <Link
                                    href={href}
                                    className={`hover:text-foreground transition-colors capitalize ${isLast ? 'font-medium text-foreground' : ''}`}
                                >
                                    {segment.replace(/-/g, ' ')}
                                </Link>
                                {!isLast && <ChevronRight className="w-4 h-4 mx-1 opacity-50" />}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <WorkspaceSwitcher />
                {/* Right side actions - Notifications */}
                <NotificationPanel />
            </div>
        </header>
    );
}
