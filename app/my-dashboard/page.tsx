"use client";

import { Suspense } from "react";
import MyDashboard from "@/components/pages/MyDashboard";

export default function MyDashboardPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MyDashboard />
        </Suspense>
    );
}
