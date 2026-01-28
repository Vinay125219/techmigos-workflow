import { Suspense } from "react";
import Tasks from "@/components/pages/Tasks";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Task Marketplace | TechMigos ProTask",
    description: "Browse and manage project tasks",
};

export default function TasksPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading tasks...</div>}>
            <Tasks />
        </Suspense>
    );
}
