"use client";

import Transactions from '@/components/pages/Transactions';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function TransactionsPage() {
  return (
    <ProtectedRoute fallback={<div className="flex min-h-screen items-center justify-center">Checking session...</div>}>
      <Transactions />
    </ProtectedRoute>
  );
}
