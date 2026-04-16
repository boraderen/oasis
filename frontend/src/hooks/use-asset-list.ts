"use client";

import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api";
import type { AssetKind, AssetSummary } from "@/lib/types";

export function useAssetList(kind: AssetKind) {
  return useQuery({
    queryKey: ["assets", kind],
    queryFn: async () => {
      const response = await apiRequest<{ status: string; assets: AssetSummary[] }>(`/api/assets/${kind}s`);
      return response.assets;
    },
  });
}
