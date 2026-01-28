"use client";

import { Suspense } from "react";
import AuthPage from "@/components/pages/Auth";

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div></div>}>
            <AuthPage />
        </Suspense>
    );
}
