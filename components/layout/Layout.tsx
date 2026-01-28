import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from '@/components/ui/toaster';
import { CommandMenu } from '@/components/ui/command-menu';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar - Fixed width */}
      <Sidebar />
      <CommandMenu />
      {/* ProductTour removed - driven by DemoDashboard only */}

      <div className="flex-1 min-h-screen flex flex-col ml-0 md:ml-20 transition-all duration-300">
        <Header />

        {/* Main Content */}
        <main className="flex-1 relative">
          <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto animate-fade-in pb-20">
            {children}
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
