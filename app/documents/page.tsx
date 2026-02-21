"use client";

import Documents from '@/components/pages/Documents';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DocumentsPage() {
  return (
    <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
      <Documents />
    </ProtectedRoute>
  );
}
