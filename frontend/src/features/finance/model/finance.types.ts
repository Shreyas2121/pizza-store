export type RefundStatus = "requested" | "approved" | "rejected" | "cancelled" | "submitted" | "processing" | "processed" | "failed";
export type SettlementStatus = "imported" | "reconciling" | "needs_review" | "reconciled";
export type MatchStatus = "unmatched" | "matched" | "mismatch" | "ignored";

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface Refund {
  id: number;
  orderId: number;
  paymentAttemptId: number;
  storeId: number;
  amountPaise: number;
  currency: "INR";
  status: RefundStatus;
  reasonCode: string;
  reasonNote: string | null;
  requestedBy: number;
  requestedAt: string;
  updatedAt: string;
  failureDescription: string | null;
}

export interface SettlementBatch {
  id: number;
  storeId: number;
  providerSettlementId: string;
  providerStatus: string;
  status: SettlementStatus;
  source: "fixture" | "test_provider";
  grossAmountPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  adjustmentPaise: number;
  netAmountPaise: number;
  currency: "INR";
  utr: string | null;
  settledAt: string;
}

export interface SettlementLine {
  id: number;
  providerLineId: string;
  providerEntityId: string;
  type: "payment" | "refund" | "adjustment";
  providerStatus: string;
  amountPaise: number;
  feePaise: number;
  feeTaxPaise: number;
  matchStatus: MatchStatus;
  paymentAttemptId: number | null;
  refundId: number | null;
}

export interface ReconciliationIssue {
  id: number;
  storeId: number;
  batchId: number | null;
  settlementLineId: number | null;
  paymentAttemptId: number | null;
  refundId: number | null;
  issueType: string;
  severity: "info" | "warning" | "error" | "critical";
  status: "open" | "resolved";
  ownerUserId: number | null;
  details: Record<string, unknown>;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface SettlementDetail {
  batch: SettlementBatch;
  lines: SettlementLine[];
  issues: ReconciliationIssue[];
}

export interface ListResponse<T> { data: T[]; meta: PageMeta }
export interface CursorListResponse<T> { data: T[]; meta: { limit: number; hasNextPage: boolean; nextCursor: number | null } }

export type CashSessionStatus = "open" | "closed";
export type CashMovementType = "cod_collection" | "refund" | "cash_in" | "cash_out" | "deposit" | "adjustment";

export interface CashSession {
  id: number;
  storeId: number;
  businessDate: string;
  status: CashSessionStatus;
  currency: "INR";
  openingFloatPaise: number;
  expectedCashPaise: number;
  countedCashPaise: number | null;
  variancePaise: number | null;
  materialVarianceAcknowledged: boolean;
  version: number;
  openedBy: number;
  openedAt: string;
  closedBy: number | null;
  closedAt: string | null;
}

export interface CashMovement {
  id: number;
  sessionId: number;
  type: CashMovementType;
  amountPaise: number;
  orderId: number | null;
  refundId: number | null;
  reversesMovementId: number | null;
  reason: string | null;
  recordedBy: number | null;
  occurredAt: string;
}

export interface CashSessionClosure {
  id: number;
  sessionVersion: number;
  expectedCashPaise: number;
  countedCashPaise: number;
  variancePaise: number;
  materialVarianceAcknowledged: boolean;
  closedBy: number;
  closedAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface CashSessionDetail {
  session: CashSession;
  movements: CashMovement[];
  closures: CashSessionClosure[];
}

export interface ProductCostVersion { id: number; storeId: number; storeProductId: number; unitCostPaise: number; effectiveFrom: string; effectiveTo: string | null; source: string; createdBy: number; createdAt: string; }
export interface ProductCostRow { cost: ProductCostVersion; productId: number; productName: string; }
export interface Vendor { id: number; storeId: number | null; name: string; taxRegistrationNumber: string | null; contactName: string | null; email: string | null; phone: string | null; address: string | null; paymentTermsDays: number; isActive: boolean; }
export interface ExpenseCategory { id: number; storeId: number | null; parentId: number | null; name: string; classification: "fixed" | "variable"; ledgerAccountId: number | null; isActive: boolean; }
export type ExpenseStatus = "draft" | "submitted" | "approved" | "paid" | "posted" | "rejected" | "voided" | "reversed";
export interface Expense { id: number; storeId: number; vendorId: number | null; vendorName: string | null; expenseDate: string; description: string; subtotalPaise: number; taxPaise: number; totalPaise: number; currency: "INR"; status: ExpenseStatus; paymentMethod: "bank_transfer" | "cash" | "card" | "upi" | "other" | null; paymentReference: string | null; version: number; createdBy: number; approvedBy: number | null; paidBy: number | null; createdAt: string; updatedAt: string; }
export interface ExpenseAllocation { id: number; expenseId: number; storeId: number; categoryId: number; categoryName: string; categoryClassification: "fixed" | "variable"; ledgerAccountId: number | null; costCenter: string | null; amountPaise: number; }
export interface ExpenseDetail { expense: Expense; allocations: ExpenseAllocation[]; }
export interface ExpenseAttachment { id: number; expenseId: number; originalName: string; mediaType: string; sizeBytes: number; sha256: string; uploadedBy: number; createdAt: string; }
export interface SourceMargin { deliveredSalesPaise: number; cogsPaise: number; operatingExpensesPaise: number; grossProfitPaise: number; grossMarginBps: number | null; operatingResultPaise: number; totalOrderLines: number; costedOrderLines: number; costCoverageComplete: boolean; basis: "source_based_pre_ledger"; }
export interface ExpenseWritePayload { storeId: number; vendorId?: number | null; expenseDate: string; description: string; subtotalPaise: number; taxPaise: number; totalPaise: number; allocations: Array<{ storeId: number; categoryId: number; costCenter?: string | null; amountPaise: number }>; }

export type LedgerAccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "contra_revenue";
export interface LedgerAccount { id: number; code: string; name: string; type: LedgerAccountType; normalSide: "debit" | "credit"; isSystem: boolean; isActive: boolean; }
export interface JournalEntry { id: number; storeId: number; journalNumber: string; businessDate: string; occurredAt: string; description: string; sourceType: string; sourceId: string; eventType: string; sourceVersion: number; status: "posted" | "reversed"; postedBy: number | null; postedAt: string; reversalOfJournalEntryId: number | null; reversalReason: string | null; }
export interface JournalLine { id: number; lineNumber: number; accountId: number; debitPaise: number; creditPaise: number; description: string | null; orderId: number | null; paymentAttemptId: number | null; refundId: number | null; expenseId: number | null; dimensions: Record<string, unknown>; account: LedgerAccount; }
export interface JournalDetail extends JournalEntry { lines: JournalLine[]; }
export interface TrialBalanceAccount { accountId: number; accountCode: string; accountName: string; accountType: LedgerAccountType; normalSide: "debit" | "credit"; debitPaise: string; creditPaise: string; netDebitPaise: string; }
export interface TrialBalance { accounts: TrialBalanceAccount[]; totals: { debitPaise: string; creditPaise: string; differencePaise: string }; policy: { currency: "INR"; basis: "posted_journals"; from: string | null; to: string | null; balanced: boolean }; }
export interface FiscalPeriod { id: number; storeId: number; name: string; startDate: string; endDate: string; status: "open" | "soft_closed" | "closed"; softClosedAt: string | null; closedAt: string | null; }

export type FinanceReportGroup = "month" | "quarter" | "fiscal_year";
export interface FinanceReportPeriod { from: string; to: string; }
export interface FinanceReportPolicy { currency: "INR"; timezone: string; dateBasis: "journal_business_date"; recognitionBasis: "delivery"; includedJournalStatuses: ["posted", "reversed"]; generatedAt: string; scope: { kind: "store" | "consolidated"; storeIds: number[] }; }
export interface FinanceReportTotals { salesRevenuePaise: string; deliveryRevenuePaise: string; discountsPaise: string; refundsPaise: string; recognizedRevenuePaise: string; collectionsPaise: string; cogsPaise: string; grossProfitPaise: string; grossMarginBps: number | null; operatingExpensesPaise: string; payrollCostPaise: string; operatingResultPaise: string; unsettledRazorpayPaise: string; cashVariancePaise: string; }
export interface FinanceOverviewReport { policy: FinanceReportPolicy; period: FinanceReportPeriod; comparisonPeriod: FinanceReportPeriod; kpis: FinanceReportTotals & { openReconciliationIssues: number | null }; comparison: { period: FinanceReportPeriod; kpis: FinanceReportTotals & { openReconciliationIssues: number | null } }; drillDownUrls: Record<string, string>; }
export interface FinanceSalesPoint { period: string; salesRevenuePaise: string; deliveryRevenuePaise: string; discountsPaise: string; refundsPaise: string; recognizedRevenuePaise: string; }
export interface FinanceMarginPoint { period: string; recognizedRevenuePaise: string; cogsPaise: string; grossProfitPaise: string; grossMarginBps: number | null; }
export interface FinanceExpenseLine { accountCode: string; accountName: string; amountPaise: string; }
export interface FinanceProfitAndLossPoint extends FinanceMarginPoint { operatingExpensesPaise: string; payrollCostPaise: string; operatingResultPaise: string; }
export interface FinanceSalesReport { policy: FinanceReportPolicy; period: FinanceReportPeriod; comparisonPeriod: FinanceReportPeriod; groupBy: FinanceReportGroup; totals: FinanceReportTotals; series: FinanceSalesPoint[]; comparison: { totals: FinanceReportTotals; series: FinanceSalesPoint[] }; }
export interface FinanceMarginsReport { policy: FinanceReportPolicy; period: FinanceReportPeriod; comparisonPeriod: FinanceReportPeriod; groupBy: FinanceReportGroup; totals: FinanceReportTotals; series: FinanceMarginPoint[]; comparison: { totals: FinanceReportTotals; series: FinanceMarginPoint[] }; }
export interface FinanceProfitAndLossReport { policy: FinanceReportPolicy; period: FinanceReportPeriod; comparisonPeriod: FinanceReportPeriod; groupBy: FinanceReportGroup; totals: FinanceReportTotals; operatingExpenseLines: FinanceExpenseLine[]; periods: FinanceProfitAndLossPoint[]; comparison: { totals: FinanceReportTotals; operatingExpenseLines: FinanceExpenseLine[]; periods: FinanceProfitAndLossPoint[] }; }

export interface JournalFilters { from?: string; to?: string; accountCodes?: string[]; excludeAccountCodes?: string[]; accountTypes?: LedgerAccountType[]; eventType?: string; sourceType?: string; sourceId?: string; }
