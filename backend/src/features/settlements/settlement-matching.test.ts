import { describe, expect, it } from "vitest";
import { matchSettlement } from "./settlement-matching";

const payment = { id: 11, providerPaymentId: "pay_1", status: "captured", amountPaise: 10_000, currency: "INR" };
const refund = { id: 21, providerRefundId: "rfnd_1", status: "processed", amountPaise: 2_000, currency: "INR" };
const lines = [
  { id: 1, type: "payment" as const, providerTransactionId: "pay_1", providerEntityId: "pay_1", providerStatus: "captured", amountPaise: 10_000, currency: "INR" },
  { id: 2, type: "refund" as const, providerTransactionId: "rfnd_1", providerEntityId: "rfnd_1", providerStatus: "processed", amountPaise: -2_000, currency: "INR" },
];

describe("deterministic settlement matching", () => {
  it("matches captured attempts and processed refunds by immutable provider reference", () => {
    expect(matchSettlement({ lines, paymentAttempts: [payment], refunds: [refund] })).toEqual({
      lineMatches: [
        { lineId: 1, matchStatus: "matched", paymentAttemptId: 11, refundId: null },
        { lineId: 2, matchStatus: "matched", paymentAttemptId: null, refundId: 21 },
      ],
      issues: [],
    });
  });

  it("surfaces amount, currency, status, duplicate, and missing-reference cases", () => {
    const result = matchSettlement({
      lines: [
        { ...lines[0], amountPaise: 9_999 },
        { ...lines[0], id: 3 },
        { ...lines[1], currency: "USD", providerStatus: "pending" },
        { ...lines[0], id: 4, providerEntityId: "pay_unknown", providerTransactionId: "pay_unknown" },
      ],
      paymentAttempts: [{ ...payment }, { ...payment, id: 12, providerPaymentId: "pay_missing" }],
      refunds: [{ ...refund, status: "processing" }],
    });

    expect(result.issues.map((item) => item.issueType)).toEqual(expect.arrayContaining([
      "amount_mismatch", "duplicate", "currency_mismatch", "stale_pending", "missing_local", "missing_provider",
    ]));
    expect(result.lineMatches.every((item) => item.matchStatus !== "matched")).toBe(true);
  });

  it("ignores explicit provider adjustments while still reconciling local coverage", () => {
    const result = matchSettlement({
      lines: [{ id: 5, type: "adjustment", providerTransactionId: "adj_1", providerEntityId: "adj_1", providerStatus: "processed", amountPaise: -100, currency: "INR" }],
      paymentAttempts: [],
      refunds: [],
    });
    expect(result).toEqual({
      lineMatches: [{ lineId: 5, matchStatus: "ignored", paymentAttemptId: null, refundId: null }],
      issues: [],
    });
  });
});
