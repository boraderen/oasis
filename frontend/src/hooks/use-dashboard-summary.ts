"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => {
      const response = await apiRequest<{ status: string; counts: DashboardSummary["counts"] }>("/api/dashboard/summary");
      return { counts: response.counts };
    },
  });
}
