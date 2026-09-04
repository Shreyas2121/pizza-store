import type {
  ReconciliationIssueSeverity,
  ReconciliationIssueType,
  SettlementLineType,
  SettlementMatchStatus,
} from "../../utils/types";

export interface MatchableSettlementLine {
  id: number;
  type: SettlementLineType;
  providerTransactionId: string;
  providerEntityId: string;
  providerStatus: string;
  amountPaise: number;
  currency: string;
}

export interface MatchablePaymentAttempt {
  id: number;
  providerPaymentId: string | null;
  status: string;
  amountPaise: number;
  currency: string;
  expectedInProvider?: boolean;
}

export interface MatchableRefund {
  id: number;
  providerRefundId: string | null;
  status: string;
  amountPaise: number;
  currency: string;
  expectedInProvider?: boolean;
}

export interface SettlementLineMatch {
  lineId: number;
  matchStatus: SettlementMatchStatus;
  paymentAttemptId: number | null;
  refundId: number | null;
}

export interface MatchingIssue {
  settlementLineId: number | null;
  paymentAttemptId: number | null;
  refundId: number | null;
  issueType: ReconciliationIssueType;
  severity: ReconciliationIssueSeverity;
  details: Record<string, unknown>;
}

const referenceFor = (line: MatchableSettlementLine) =>
  line.providerEntityId || line.providerTransactionId;

const issue = (
  line: MatchableSettlementLine | null,
  issueType: ReconciliationIssueType,
  severity: ReconciliationIssueSeverity,
  details: Record<string, unknown>,
  paymentAttemptId: number | null = null,
  refundId: number | null = null
): MatchingIssue => ({
  settlementLineId: line?.id ?? null,
  paymentAttemptId,
  refundId,
  issueType,
  severity,
  details,
});

export const matchSettlement = (input: {
  lines: MatchableSettlementLine[];
  paymentAttempts: MatchablePaymentAttempt[];
  refunds: MatchableRefund[];
}) => {
  const lineMatches: SettlementLineMatch[] = [];
  const issues: MatchingIssue[] = [];
  const seenReferences = new Set<string>();
  const providerPaymentIds = new Set<string>();
  const providerRefundIds = new Set<string>();
  const attempts = new Map(
    input.paymentAttempts.flatMap((item) => item.providerPaymentId ? [[item.providerPaymentId, item] as const] : [])
  );
  const refunds = new Map(
    input.refunds.flatMap((item) => item.providerRefundId ? [[item.providerRefundId, item] as const] : [])
  );

  for (const line of input.lines) {
    if (line.type === "adjustment") {
      lineMatches.push({ lineId: line.id, matchStatus: "ignored", paymentAttemptId: null, refundId: null });
      continue;
    }

    const reference = referenceFor(line);
    const duplicateKey = `${line.type}:${reference}`;
    if (seenReferences.has(duplicateKey)) {
      lineMatches.push({ lineId: line.id, matchStatus: "mismatch", paymentAttemptId: null, refundId: null });
      issues.push(issue(line, "duplicate", "critical", { reference, type: line.type }));
      continue;
    }
    seenReferences.add(duplicateKey);

    if (line.type === "payment") {
      providerPaymentIds.add(reference);
      const local = attempts.get(reference);
      if (!local) {
        lineMatches.push({ lineId: line.id, matchStatus: "unmatched", paymentAttemptId: null, refundId: null });
        issues.push(issue(line, "missing_local", "error", { reference, type: "payment" }));
        continue;
      }
      const failures: MatchingIssue[] = [];
      if (local.amountPaise !== line.amountPaise) failures.push(issue(line, "amount_mismatch", "critical", {
        providerAmountPaise: line.amountPaise, localAmountPaise: local.amountPaise,
      }, local.id));
      if (local.currency !== line.currency) failures.push(issue(line, "currency_mismatch", "critical", {
        providerCurrency: line.currency, localCurrency: local.currency,
      }, local.id));
      if (local.status !== "captured" || line.providerStatus !== "captured") failures.push(issue(
        line,
        ["pending", "processing", "authorized"].includes(local.status) ? "stale_pending" : "unexpected_status",
        "error",
        { providerStatus: line.providerStatus, localStatus: local.status },
        local.id
      ));
      issues.push(...failures);
      lineMatches.push({
        lineId: line.id,
        matchStatus: failures.length ? "mismatch" : "matched",
        paymentAttemptId: local.id,
        refundId: null,
      });
      continue;
    }

    providerRefundIds.add(reference);
    const local = refunds.get(reference);
    if (!local) {
      lineMatches.push({ lineId: line.id, matchStatus: "unmatched", paymentAttemptId: null, refundId: null });
      issues.push(issue(line, "missing_local", "error", { reference, type: "refund" }));
      continue;
    }
    const failures: MatchingIssue[] = [];
    if (local.amountPaise !== Math.abs(line.amountPaise)) failures.push(issue(line, "amount_mismatch", "critical", {
      providerAmountPaise: Math.abs(line.amountPaise), localAmountPaise: local.amountPaise,
    }, null, local.id));
    if (local.currency !== line.currency) failures.push(issue(line, "currency_mismatch", "critical", {
      providerCurrency: line.currency, localCurrency: local.currency,
    }, null, local.id));
    if (local.status !== "processed" || line.providerStatus !== "processed") failures.push(issue(
      line,
      ["submitted", "processing"].includes(local.status) ? "stale_pending" : "unexpected_status",
      "error",
      { providerStatus: line.providerStatus, localStatus: local.status },
      null,
      local.id
    ));
    issues.push(...failures);
    lineMatches.push({
      lineId: line.id,
      matchStatus: failures.length ? "mismatch" : "matched",
      paymentAttemptId: null,
      refundId: local.id,
    });
  }

  for (const local of input.paymentAttempts) {
    if (local.expectedInProvider !== false && local.providerPaymentId && !providerPaymentIds.has(local.providerPaymentId)) {
      issues.push(issue(null, "missing_provider", "error", {
        reference: local.providerPaymentId, type: "payment", localAmountPaise: local.amountPaise,
      }, local.id));
    }
  }
  for (const local of input.refunds) {
    if (local.expectedInProvider !== false && local.providerRefundId && !providerRefundIds.has(local.providerRefundId)) {
      issues.push(issue(null, "missing_provider", "error", {
        reference: local.providerRefundId, type: "refund", localAmountPaise: local.amountPaise,
      }, null, local.id));
    }
  }

  return { lineMatches, issues };
};
