"use client";

import ManagerDashboard from "@/components/pages/ManagerDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function ManagerDashboardPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <ManagerDashboard />
        </ProtectedRoute>
    );
}
