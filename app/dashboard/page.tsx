"use client";

import Index from "@/components/pages/Index";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Index />
        </ProtectedRoute>
    );
}
