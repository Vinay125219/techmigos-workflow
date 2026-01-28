"use client";

import { Suspense } from "react";
import Projects from "@/components/pages/Projects";

export default function ProjectsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Projects />
        </Suspense>
    );
}
