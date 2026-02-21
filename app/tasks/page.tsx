import { Suspense } from "react";
import Tasks from "@/components/pages/Tasks";
import { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export const metadata: Metadata = {
    title: "Task Marketplace | TechMigos ProTask",
    description: "Browse and manage project tasks",
};

export default function TasksPage() {
    return (
        <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading tasks...</div>}>
                <Tasks />
            </Suspense>
        </ProtectedRoute>
    );
}
