"use client";

import Ideas from "@/components/pages/Ideas";
import { Suspense } from "react";

export default function IdeasPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Ideas />
        </Suspense>
    );
}
