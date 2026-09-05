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
