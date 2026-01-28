"use client";

import { Suspense } from "react";
import Analytics from "@/components/pages/Analytics";

export default function AnalyticsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Analytics />
        </Suspense>
    );
}
