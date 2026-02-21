"use client";

import Admin from "@/components/pages/Admin";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function AdminPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Admin />
        </ProtectedRoute>
    );
}
