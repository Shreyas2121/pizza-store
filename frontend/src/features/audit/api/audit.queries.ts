import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { AuditListResponse } from "../model/audit.types";

export interface AuditFilters {
  page: number;
  action?: string;
  actorUserId?: number;
  from?: string;
  to?: string;
}

export const auditKeys = {
  all: ["audit"] as const,
  list: (scope: "global" | "store", storeId: number | null, filters: AuditFilters) =>
    ["audit", scope, storeId, filters] as const,
};

export const useAuditList = (
  global: boolean,
  storeId: number | null,
  filters: AuditFilters
) => useQuery({
  queryKey: auditKeys.list(global ? "global" : "store", storeId, filters),
  queryFn: async () => (await API.get<AuditListResponse>(
    global ? "/audit" : `/stores/${storeId}/audit`,
    { params: { ...filters, limit: 25, storeId: global ? storeId ?? undefined : undefined } }
  )).data,
  enabled: global || !!storeId,
  placeholderData: keepPreviousData,
});
