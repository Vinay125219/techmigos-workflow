"use client";

import Planning from "@/components/pages/Planning";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function PlanningPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Planning />
        </ProtectedRoute>
    );
}
