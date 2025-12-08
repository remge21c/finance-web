"use client";

import { useDataContext } from "@/lib/contexts/DataContext";
import type { TransactionInput } from "@/types/database";

export function useTransactions() {
  const context = useDataContext();

  return {
    transactions: context.transactions,
    loading: context.loading,
    addTransaction: context.addTransaction,
    updateTransaction: context.updateTransaction,
    deleteTransaction: context.deleteTransaction,
    deleteMultipleTransactions: context.deleteMultipleTransactions,
    refetch: context.refetchTransactions,
  };
}
