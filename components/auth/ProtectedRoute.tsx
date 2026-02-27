"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
}

function buildRedirectPath(pathname: string | null, rawSearch: string): string {
    const safePath = pathname || "/";
    const query = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
    return query ? `${safePath}?${query}` : safePath;
}

export function ProtectedRoute({ children, fallback = null }: ProtectedRouteProps) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading || isAuthenticated) return;
        const rawSearch = typeof window === "undefined" ? "" : window.location.search;
        const redirectPath = buildRedirectPath(pathname, rawSearch);
        router.replace(`/auth?redirectTo=${encodeURIComponent(redirectPath)}`);
    }, [loading, isAuthenticated, pathname, router]);

    if (loading) return <>{fallback}</>;
    if (!isAuthenticated) return <>{fallback}</>;
    return <>{children}</>;
}
