"use client";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { useDeadlineReminders } from "@/hooks/useDeadlineReminders";
import { EmailVerificationHandler } from "@/components/auth/EmailVerificationHandler";
import React, { useState } from "react";

function AppContent({ children }: { children: React.ReactNode }) {
    // Initialize deadline reminders
    useDeadlineReminders();

    return (
        <>
            <EmailVerificationHandler />
            {children}
        </>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <AuthProvider>
                    <WorkspaceProvider>
                        <Toaster />
                        <Sonner />
                        <AppContent>{children}</AppContent>
                    </WorkspaceProvider>
                </AuthProvider>
            </TooltipProvider>
        </QueryClientProvider>
    );
}
