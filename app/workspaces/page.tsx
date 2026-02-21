"use client";

import Workspaces from "@/components/pages/Workspaces";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function WorkspacesPage() {
  return (
    <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
      <Workspaces />
    </ProtectedRoute>
  );
}
