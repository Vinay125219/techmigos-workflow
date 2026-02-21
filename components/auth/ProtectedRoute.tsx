"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
}

function buildRedirectPath(pathname: string | null, searchParams: URLSearchParams): string {
    const safePath = pathname || "/";
    const query = searchParams.toString();
    return query ? `${safePath}?${query}` : safePath;
}

export function ProtectedRoute({ children, fallback = null }: ProtectedRouteProps) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const redirectPath = buildRedirectPath(pathname, searchParams);

    useEffect(() => {
        if (loading || isAuthenticated) return;
        router.replace(`/auth?redirectTo=${encodeURIComponent(redirectPath)}`);
    }, [loading, isAuthenticated, redirectPath, router]);

    if (loading) return <>{fallback}</>;
    if (!isAuthenticated) return <>{fallback}</>;
    return <>{children}</>;
}
