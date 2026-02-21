"use client";

import Ideas from "@/components/pages/Ideas";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function IdeasPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Suspense fallback={<div>Loading...</div>}>
                <Ideas />
            </Suspense>
        </ProtectedRoute>
    );
}
