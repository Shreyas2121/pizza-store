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
