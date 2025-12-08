"use client";

import { useDataContext } from "@/lib/contexts/DataContext";

export function useSettings() {
  const context = useDataContext();

  return {
    settings: context.settings,
    loading: context.loading,
    updateSettings: context.updateSettings,
    refetch: context.refetchSettings,
  };
}










