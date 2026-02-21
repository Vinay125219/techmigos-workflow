"use client";

import { Suspense } from "react";
import MyDashboard from "@/components/pages/MyDashboard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function MyDashboardPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Suspense fallback={<div>Loading...</div>}>
                <MyDashboard />
            </Suspense>
        </ProtectedRoute>
    );
}
