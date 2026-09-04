import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type {
  ListResponse,
  ReconciliationIssue,
  Refund,
  RefundStatus,
  SettlementBatch,
  SettlementDetail,
} from "../model/finance.types";

export const financeKeys = {
  refunds: (storeId: number | null, status?: string) => ["finance", "refunds", storeId, status] as const,
  settlements: (storeId: number | null) => ["finance", "settlements", storeId] as const,
  settlement: (id: number | null) => ["finance", "settlement", id] as const,
  issues: (storeId: number | null) => ["finance", "issues", storeId] as const,
};

export const useRefunds = (storeId: number | null, status?: RefundStatus) => useQuery({
  queryKey: financeKeys.refunds(storeId, status),
  queryFn: async () => (await API.get<ListResponse<Refund>>("/finance/refunds", { params: { storeId, status } })).data,
  enabled: Boolean(storeId),
  placeholderData: keepPreviousData,
});

export const useSettlements = (storeId: number | null, enabled = true) => useQuery({
  queryKey: financeKeys.settlements(storeId),
  queryFn: async () => (await API.get<ListResponse<SettlementBatch>>("/finance/settlements", { params: { storeId } })).data,
  enabled: Boolean(storeId) && enabled,
  placeholderData: keepPreviousData,
});

export const useSettlement = (id: number | null) => useQuery({
  queryKey: financeKeys.settlement(id),
  queryFn: async () => (await API.get<{ data: SettlementDetail }>(`/finance/settlements/${id}`)).data.data,
  enabled: Boolean(id),
});

export const useReconciliationIssues = (storeId: number | null, enabled = true) => useQuery({
  queryKey: financeKeys.issues(storeId),
  queryFn: async () => (await API.get<ListResponse<ReconciliationIssue>>("/finance/reconciliation/issues", { params: { storeId, status: "open" } })).data,
  enabled: Boolean(storeId) && enabled,
  placeholderData: keepPreviousData,
});

const useFinanceMutation = <TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ["finance"] }),
  });
};

export const useRequestRefund = () => useFinanceMutation(async (input: {
  orderId: number;
  idempotencyKey: string;
  amountPaise: number;
  reasonCode: string;
  reasonNote?: string;
  allocations: Array<{ orderItemId: number; quantity: number; allocatedPaise: number } | { type: "delivery_fee"; allocatedPaise: number }>;
}) => (await API.post(`/finance/orders/${input.orderId}/refunds`, {
  amountPaise: input.amountPaise,
  reasonCode: input.reasonCode,
  reasonNote: input.reasonNote,
  allocations: input.allocations,
}, { headers: { "Idempotency-Key": input.idempotencyKey } })).data);

export const useApproveRefund = () => useFinanceMutation(async (input: { refundId: number; codCashReturned?: boolean }) =>
  (await API.post(`/finance/refunds/${input.refundId}/approve`, { codCashReturned: input.codCashReturned })).data
);

export const useRejectRefund = () => useFinanceMutation(async (input: { refundId: number; reason: string }) =>
  (await API.post(`/finance/refunds/${input.refundId}/reject`, { reason: input.reason })).data
);

export const useRetryRefund = () => useFinanceMutation(async (refundId: number) =>
  (await API.post(`/finance/refunds/${refundId}/retry`)).data
);

export const useImportSettlement = () => useFinanceMutation(async (input:
  | { source: "fixture"; providerSettlementId: string }
  | { source: "test_provider"; providerSettlementId: string; storeId: number }
) => (await API.post<{ data: SettlementBatch; imported: boolean }>("/finance/settlements/import", input)).data);

export const useReconcileSettlement = () => useFinanceMutation(async (id: number) =>
  (await API.post<{ data: SettlementDetail }>(`/finance/settlements/${id}/reconcile`)).data.data
);

export const useResolveIssue = () => useFinanceMutation(async (input: { issueId: number; reason: string }) =>
  (await API.post(`/finance/reconciliation/issues/${input.issueId}/resolve`, { reason: input.reason })).data
);
