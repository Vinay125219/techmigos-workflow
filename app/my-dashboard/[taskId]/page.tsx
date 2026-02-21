"use client";

import MyDashboard from "@/components/pages/MyDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function MyDashboardTaskPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <MyDashboard />
        </ProtectedRoute>
    );
}
