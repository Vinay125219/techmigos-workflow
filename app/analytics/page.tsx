"use client";

import { Suspense } from "react";
import Analytics from "@/components/pages/Analytics";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function AnalyticsPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Suspense fallback={<div>Loading...</div>}>
                <Analytics />
            </Suspense>
        </ProtectedRoute>
    );
}
