import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type {
  ListResponse,
  ReconciliationIssue,
  Refund,
  RefundStatus,
  RefundReconciliationResult,
  SettlementBatch,
  SettlementDetail,
  CashSession,
  CashSessionDetail,
  CashMovementType,
  ProductCostRow,
  Vendor,
  ExpenseCategory,
  Expense,
  ExpenseStatus,
  ExpenseDetail,
  ExpenseAttachment,
  SourceMargin,
  ExpenseWritePayload,
  LedgerAccount,
  JournalEntry,
  JournalDetail,
  TrialBalance,
  FiscalPeriod,
  FinanceOverviewReport,
  FinanceProfitAndLossReport,
  FinanceSalesReport,
  FinanceMarginsReport,
  FinanceReportGroup,
  JournalFilters,
  CursorListResponse,
} from "../model/finance.types";

export const financeKeys = {
  all: ["finance"] as const,
  refunds: (storeId: number | null, status?: string, page = 1) => ["finance", "refunds", storeId, status, page] as const,
  stuckRefunds: (storeId: number | null, olderThanMinutes: number, page: number) => ["finance", "refunds-stuck", storeId, olderThanMinutes, page] as const,
  settlements: (storeId: number | null) => ["finance", "settlements", storeId] as const,
  settlement: (id: number | null) => ["finance", "settlement", id] as const,
  issues: (storeId: number | null | undefined) => ["finance", "issues", storeId] as const,
  cashSessions: (storeId: number | null) => ["finance", "cash-sessions", storeId] as const,
  cashSession: (id: number | null) => ["finance", "cash-session", id] as const,
  costs: (storeId: number | null) => ["finance", "costs", storeId] as const,
  vendors: (storeId: number | null) => ["finance", "vendors", storeId] as const,
  categories: (storeId: number | null) => ["finance", "expense-categories", storeId] as const,
  expenses: (storeId: number | null, status?: string) => ["finance", "expenses", storeId, status] as const,
  expense: (id: number | null) => ["finance", "expense", id] as const,
  attachments: (id: number | null) => ["finance", "expense", id, "attachments"] as const,
  sourceMargin: (storeId: number | null) => ["finance", "source-margin", storeId] as const,
  ledgerAccounts: (storeId: number | null) => ["finance", "ledger", "accounts", storeId] as const,
  journals: (storeId: number | null, filters?: JournalFilters) => ["finance", "ledger", "journals", storeId, filters] as const,
  journal: (id: number | null) => ["finance", "ledger", "journal", id] as const,
  trialBalance: (storeId: number | null) => ["finance", "ledger", "trial-balance", storeId] as const,
  periods: (storeId: number | null) => ["finance", "ledger", "periods", storeId] as const,
  overview: (storeId: number | null | undefined, from: string, to: string) => ["finance", "reports", "overview", storeId, from, to] as const,
  profitAndLoss: (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => ["finance", "reports", "pnl", storeId, from, to, groupBy] as const,
  salesReport: (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => ["finance", "reports", "sales", storeId, from, to, groupBy] as const,
  marginsReport: (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => ["finance", "reports", "margins", storeId, from, to, groupBy] as const,
};

export const useLedgerAccounts = (storeId: number | null) => useQuery({ queryKey: financeKeys.ledgerAccounts(storeId), queryFn: async () => (await API.get<{ data: LedgerAccount[] }>("/finance/ledger/accounts", { params: { storeId } })).data.data, enabled: Boolean(storeId) });
export const useJournals = (storeId: number | null | undefined, filters?: JournalFilters) => useQuery({ queryKey: financeKeys.journals(storeId ?? null, filters), queryFn: async () => (await API.get<{ data: JournalEntry[] }>("/finance/ledger/journals", { params: { storeId: storeId ?? undefined, limit: 50, ...filters, accountCodes: filters?.accountCodes?.join(","), excludeAccountCodes: filters?.excludeAccountCodes?.join(","), accountTypes: filters?.accountTypes?.join(",") } })).data.data, enabled: storeId !== undefined, staleTime: 60_000 });
export const useJournalDrillDown = (storeId: number | null, filters: JournalFilters) => useQuery({ queryKey: [...financeKeys.journals(storeId, filters), "drill-down"], queryFn: async () => (await API.get<CursorListResponse<JournalEntry>>("/finance/ledger/journals", { params: { storeId: storeId ?? undefined, limit: 50, ...filters, accountCodes: filters.accountCodes?.join(","), excludeAccountCodes: filters.excludeAccountCodes?.join(","), accountTypes: filters.accountTypes?.join(",") } })).data, staleTime: 60_000 });
export const useJournal = (id: number | null) => useQuery({ queryKey: financeKeys.journal(id), queryFn: async () => (await API.get<{ data: JournalDetail }>(`/finance/ledger/journals/${id}`)).data.data, enabled: Boolean(id) });
export const useTrialBalance = (storeId: number | null) => useQuery({ queryKey: financeKeys.trialBalance(storeId), queryFn: async () => (await API.get<{ data: TrialBalance }>("/finance/ledger/trial-balance", { params: { storeId } })).data.data, enabled: Boolean(storeId) });
export const useFiscalPeriods = (storeId: number | null) => useQuery({ queryKey: financeKeys.periods(storeId), queryFn: async () => (await API.get<{ data: FiscalPeriod[] }>("/finance/ledger/periods", { params: { storeId } })).data.data, enabled: Boolean(storeId) });

const reportParams = (storeId: number | null | undefined, from: string, to: string, groupBy?: FinanceReportGroup) => ({ from, to, storeId: storeId ?? undefined, groupBy });
const reportEnabled = (storeId: number | null | undefined, from: string, to: string) => storeId !== undefined && Boolean(from && to);
export const useFinanceOverview = (storeId: number | null | undefined, from: string, to: string) => useQuery({ queryKey: financeKeys.overview(storeId, from, to), queryFn: async () => (await API.get<{ data: FinanceOverviewReport }>("/finance/overview", { params: reportParams(storeId, from, to) })).data.data, enabled: reportEnabled(storeId, from, to), staleTime: 60_000 });
export const useFinanceProfitAndLoss = (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => useQuery({ queryKey: financeKeys.profitAndLoss(storeId, from, to, groupBy), queryFn: async () => (await API.get<{ data: FinanceProfitAndLossReport }>("/finance/profit-and-loss", { params: reportParams(storeId, from, to, groupBy) })).data.data, enabled: reportEnabled(storeId, from, to), staleTime: 60_000 });
export const useFinanceSales = (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => useQuery({ queryKey: financeKeys.salesReport(storeId, from, to, groupBy), queryFn: async () => (await API.get<{ data: FinanceSalesReport }>("/finance/sales", { params: reportParams(storeId, from, to, groupBy) })).data.data, enabled: reportEnabled(storeId, from, to), staleTime: 60_000 });
export const useFinanceMargins = (storeId: number | null | undefined, from: string, to: string, groupBy: FinanceReportGroup) => useQuery({ queryKey: financeKeys.marginsReport(storeId, from, to, groupBy), queryFn: async () => (await API.get<{ data: FinanceMarginsReport }>("/finance/margins", { params: reportParams(storeId, from, to, groupBy) })).data.data, enabled: reportEnabled(storeId, from, to), staleTime: 60_000 });
export type FinanceExportType = "overview" | "profit-and-loss" | "sales" | "margins";
export const useDownloadFinanceExport = () => useMutation({ mutationFn: async (input: { reportType: FinanceExportType; storeId: number | null; from: string; to: string; groupBy: FinanceReportGroup }) => {
  const response = await API.get<Blob>(`/finance/exports/${input.reportType}`, { params: reportParams(input.storeId, input.from, input.to, input.groupBy), responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `finance-${input.reportType}-${input.from}-${input.to}.csv`;
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
} });

export const useProductCosts = (storeId: number | null) => useQuery({ queryKey: financeKeys.costs(storeId), queryFn: async () => (await API.get<{ data: ProductCostRow[] }>("/finance/costs/products", { params: { storeId } })).data.data, enabled: Boolean(storeId) });
export const useVendors = (storeId: number | null) => useQuery({ queryKey: financeKeys.vendors(storeId), queryFn: async () => (await API.get<ListResponse<Vendor>>("/finance/vendors", { params: { storeId, includeInactive: true, limit: 100 } })).data.data, enabled: Boolean(storeId) });
export const useExpenseCategories = (storeId: number | null) => useQuery({ queryKey: financeKeys.categories(storeId), queryFn: async () => (await API.get<ListResponse<ExpenseCategory>>("/finance/expenses/categories", { params: { storeId, includeInactive: true, limit: 100 } })).data.data, enabled: Boolean(storeId) });
export const useExpenses = (storeId: number | null, status?: ExpenseStatus) => useQuery({ queryKey: financeKeys.expenses(storeId, status), queryFn: async () => (await API.get<ListResponse<Expense>>("/finance/expenses", { params: { storeId, status } })).data, enabled: Boolean(storeId), placeholderData: keepPreviousData });
export const useExpense = (id: number | null) => useQuery({ queryKey: financeKeys.expense(id), queryFn: async () => (await API.get<{ data: ExpenseDetail }>(`/finance/expenses/${id}`)).data.data, enabled: Boolean(id) });
export const useExpenseAttachments = (id: number | null) => useQuery({ queryKey: financeKeys.attachments(id), queryFn: async () => (await API.get<{ data: ExpenseAttachment[] }>(`/finance/expenses/${id}/attachments`)).data.data, enabled: Boolean(id) });
export const useSourceMargin = (storeId: number | null) => useQuery({ queryKey: financeKeys.sourceMargin(storeId), queryFn: async () => (await API.get<{ data: SourceMargin }>("/finance/source-margin", { params: { storeId } })).data.data, enabled: Boolean(storeId) });

export const useCashSessions = (storeId: number | null, enabled = true) => useQuery({
  queryKey: financeKeys.cashSessions(storeId),
  queryFn: async () => (await API.get<ListResponse<CashSession>>("/finance/cash/sessions", { params: { storeId } })).data,
  enabled: Boolean(storeId) && enabled,
});

export const useCashSession = (id: number | null) => useQuery({
  queryKey: financeKeys.cashSession(id),
  queryFn: async () => (await API.get<{ data: CashSessionDetail }>(`/finance/cash/sessions/${id}`)).data.data,
  enabled: Boolean(id),
});

export const useRefunds = (storeId: number | null, status?: RefundStatus, page = 1, enabled = true) => useQuery({
  queryKey: financeKeys.refunds(storeId, status, page),
  queryFn: async ({ signal }) => (await API.get<ListResponse<Refund>>("/finance/refunds", { params: { storeId, status, page, limit: 25 }, signal })).data,
  enabled: Boolean(storeId) && enabled,
});

export const useStuckRefunds = (storeId: number | null, olderThanMinutes: number, page = 1, enabled = true) => useQuery({
  queryKey: financeKeys.stuckRefunds(storeId, olderThanMinutes, page),
  queryFn: async ({ signal }) => (await API.get<ListResponse<Refund>>("/finance/refunds/stuck", { params: { storeId, olderThanMinutes, page, limit: 25 }, signal })).data,
  enabled: Boolean(storeId) && enabled,
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

export const useReconciliationIssues = (storeId: number | null | undefined, enabled = true) => useQuery({
  queryKey: financeKeys.issues(storeId),
  queryFn: async () => (await API.get<ListResponse<ReconciliationIssue>>("/finance/reconciliation/issues", { params: { storeId: storeId ?? undefined, status: "open" } })).data,
  enabled: storeId !== undefined && enabled,
  placeholderData: keepPreviousData,
});

const useFinanceMutation = <TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: financeKeys.all }),
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

export const useReconcileRefunds = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { storeId: number; olderThanMinutes: number; limit: number }) => (await API.post<{ data: RefundReconciliationResult; message: string }>("/finance/refunds/reconcile", input)).data,
    retry: false,
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: financeKeys.all }), client.invalidateQueries({ queryKey: ["order-single"] }), client.invalidateQueries({ queryKey: ["order-all"] }), client.invalidateQueries({ queryKey: ["order-adminAll"] })]); },
  });
};

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

export const useOpenCashSession = () => useFinanceMutation(async (input: { storeId: number; openingFloatPaise: number }) =>
  (await API.post<{ data: CashSession }>("/finance/cash/sessions", input)).data.data
);

export const useRecordCashMovement = () => useFinanceMutation(async (input: { sessionId: number; type: Exclude<CashMovementType, "cod_collection" | "refund">; amountPaise: number; direction?: "in" | "out"; reason: string }) =>
  (await API.post(`/finance/cash/sessions/${input.sessionId}/movements`, { type: input.type, amountPaise: input.amountPaise, direction: input.direction, reason: input.reason })).data
);

export const useCloseCashSession = () => useFinanceMutation(async (input: { sessionId: number; countedCashPaise: number; materialVarianceAcknowledged: boolean }) =>
  (await API.post(`/finance/cash/sessions/${input.sessionId}/close`, { countedCashPaise: input.countedCashPaise, materialVarianceAcknowledged: input.materialVarianceAcknowledged })).data
);

export const useReopenCashSession = () => useFinanceMutation(async (input: { sessionId: number; reason: string }) =>
  (await API.post(`/finance/cash/sessions/${input.sessionId}/reopen`, { reason: input.reason })).data
);

export const useReverseCashMovement = () => useFinanceMutation(async (input: { movementId: number; reason: string }) =>
  (await API.post(`/finance/cash/movements/${input.movementId}/reverse`, { reason: input.reason })).data
);

export const useCreateProductCost = () => useFinanceMutation(async (input: { storeId: number; storeProductId: number; unitCostPaise: number; effectiveFrom: string; effectiveTo?: string | null; source: string }) => (await API.post("/finance/costs/products", input)).data);
export const useCreateVendor = () => useFinanceMutation(async (input: { storeId: number; name: string; paymentTermsDays: number }) => (await API.post("/finance/vendors", input)).data);
export const useUpdateVendor = () => useFinanceMutation(async (input: { id: number; isActive: boolean }) => (await API.put(`/finance/vendors/${input.id}`, { isActive: input.isActive })).data);
export const useCreateExpenseCategory = () => useFinanceMutation(async (input: { storeId: number; name: string; classification: "fixed" | "variable"; ledgerAccountId?: number | null }) => (await API.post("/finance/expenses/categories", input)).data);
export const useUpdateExpenseCategory = () => useFinanceMutation(async (input: { id: number; isActive: boolean }) => (await API.put(`/finance/expenses/categories/${input.id}`, { isActive: input.isActive })).data);
export const useCreateExpense = () => useFinanceMutation(async (input: { idempotencyKey: string; data: ExpenseWritePayload }) => (await API.post("/finance/expenses", input.data, { headers: { "Idempotency-Key": input.idempotencyKey } })).data);
export const useUpdateExpense = () => useFinanceMutation(async (input: { expenseId: number; data: Omit<ExpenseWritePayload, "storeId"> }) => (await API.put<{ data: ExpenseDetail }>(`/finance/expenses/${input.expenseId}`, input.data)).data.data);
export const useExpenseCommand = () => useFinanceMutation(async (input: { expenseId: number; action: "submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse"; data?: Record<string, unknown> }) => (await API.post(`/finance/expenses/${input.expenseId}/${input.action}`, input.data ?? {}, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const useUploadExpenseReceipt = () => useFinanceMutation(async (input: { expenseId: number; file: File }) => { const body = new FormData(); body.append("receipt", input.file); return (await API.post(`/finance/expenses/${input.expenseId}/attachments`, body, { headers: { "Content-Type": "multipart/form-data" } })).data; });
export const useDownloadExpenseReceipt = () => useMutation({ mutationFn: async (input: { expenseId: number; attachment: ExpenseAttachment }) => { const response = await API.get<Blob>(`/finance/expenses/${input.expenseId}/attachments/${input.attachment.id}`, { responseType: "blob" }); const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = input.attachment.originalName; anchor.click(); URL.revokeObjectURL(url); } });
export const useOpenFiscalPeriod = () => useFinanceMutation(async (input: { storeId: number; name: string; startDate: string; endDate: string; reason: string }) => (await API.post("/finance/ledger/periods", input)).data);
export const usePeriodCommand = () => useFinanceMutation(async (input: { periodId: number; action: "soft-close" | "close" | "reopen"; reason: string }) => (await API.post(`/finance/ledger/periods/${input.periodId}/${input.action}`, { reason: input.reason })).data);
export const usePostManualJournal = () => useFinanceMutation(async (input: { storeId: number; businessDate: string; description: string; lines: Array<{ accountCode: string; side: "debit" | "credit"; amountPaise: number; description?: string }>; softCloseOverrideReason?: string }) => (await API.post("/finance/ledger/manual-journals", input, { headers: { "Idempotency-Key": crypto.randomUUID() } })).data);
export const useReverseJournal = () => useFinanceMutation(async (input: { journalId: number; businessDate: string; reason: string }) => (await API.post(`/finance/ledger/journals/${input.journalId}/reverse`, { businessDate: input.businessDate, reason: input.reason })).data);
