"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
                <p className="text-muted-foreground max-w-[500px]">
                    We apologize for the inconvenience. An unexpected error occurred while processing your request.
                </p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} variant="outline">
                    Reload Page
                </Button>
                <Button onClick={() => reset()}>Try Again</Button>
            </div>
            {process.env.NODE_ENV === "development" && (
                <div className="mt-8 max-w-2xl overflow-auto rounded-lg bg-muted p-4 text-left font-mono text-sm text-muted-foreground">
                    <p className="font-bold text-foreground mb-2">Error Details (Dev Only):</p>
                    <pre>{error.message}</pre>
                    {error.stack && <pre className="mt-2 text-xs opacity-70">{error.stack}</pre>}
                </div>
            )}
        </div>
    );
}
