"use client";

import { Suspense } from "react";
import Projects from "@/components/pages/Projects";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function ProjectsPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Suspense fallback={<div>Loading...</div>}>
                <Projects />
            </Suspense>
        </ProtectedRoute>
    );
}
