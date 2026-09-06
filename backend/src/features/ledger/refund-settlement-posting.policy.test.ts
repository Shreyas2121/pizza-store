import { describe, expect, it } from "vitest";
import type { FinancialOutboxEvent } from "../../db/schema";
import { buildDisbursedRefundPosting, buildProcessedRefundPosting, buildSettlementPosting } from "./refund-settlement-posting.policy";

const event = (eventType: FinancialOutboxEvent["eventType"], payload: Record<string, unknown>): FinancialOutboxEvent => ({
  id: 1, eventId: "evt-1", eventType, schemaVersion: 1, sourceType: eventType.startsWith("settlement") ? "settlement_batch" : "refund", sourceId: "42", sourceVersion: 4,
  storeId: 1, currency: "INR", occurredAt: new Date("2026-07-28T06:00:00.000Z"), businessDate: "2026-07-28", timezone: "Asia/Kolkata", actorId: 7,
  correlationId: null, causationId: null, payload, payloadHash: "a".repeat(64), status: "processing", attemptCount: 1, availableAt: new Date(), claimedAt: new Date(), claimedBy: "worker", processedAt: null, lastError: null, createdAt: new Date(), updatedAt: new Date(),
});

const allocation = { kind: "item", orderItemId: 10, quantity: 1, amountPaise: 40_000, taxableAmountPaise: 38_095, taxPaise: 1_905, discountReversalPaise: 0 };

describe("refund and settlement posting policy", () => {
  it("posts a finalized post-delivery refund to contra revenue, tax, and refunds payable", () => {
    const command = buildProcessedRefundPosting(event("refund.processed", { refundId: 42, orderId: 104, paymentAttemptId: 9, totalPaise: 40_000, provider: "razorpay", providerReference: "rfnd_42", processedAt: "2026-07-23T08:00:00.000Z", fulfilmentState: "delivered", recognizedAt: "2026-07-22T15:00:00.000Z", allocations: [allocation] }));
    expect(command.lines).toEqual([
      expect.objectContaining({ accountCode: "4110", side: "debit", amountPaise: 38_095 }),
      expect.objectContaining({ accountCode: "2200", side: "debit", amountPaise: 1_905 }),
      expect.objectContaining({ accountCode: "2100", side: "credit", amountPaise: 40_000 }),
    ]);
  });

  it("clears customer advances for a refund finalized before recognition", () => {
    const command = buildProcessedRefundPosting(event("refund.processed", { refundId: 42, orderId: 104, paymentAttemptId: 9, totalPaise: 40_000, provider: "razorpay", providerReference: "rfnd_42", processedAt: "2026-07-23T08:00:00.000Z", fulfilmentState: "cancelled", recognizedAt: null, allocations: [allocation] }));
    expect(command.lines.map(({ accountCode, side }) => [accountCode, side])).toEqual([["2000", "debit"], ["2100", "credit"]]);
  });

  it("clears refunds payable through provider clearing or cash", () => {
    const online = buildDisbursedRefundPosting(event("refund.disbursed", { refundId: 42, orderId: 104, method: "razorpay", disbursedPaise: 40_000, clearingReference: "rfnd_42", disbursedAt: "2026-07-23T08:00:00.000Z" }));
    const cash = buildDisbursedRefundPosting(event("refund.disbursed", { refundId: 43, orderId: 105, method: "cash", disbursedPaise: 5_000, clearingReference: "cash-movement:8", disbursedAt: "2026-07-23T08:00:00.000Z" }));
    expect(online.lines[1]).toMatchObject({ accountCode: "1100", side: "credit", amountPaise: 40_000 });
    expect(cash.lines[1]).toMatchObject({ accountCode: "1000", side: "credit", amountPaise: 5_000 });
  });

  it("reconciles the fixture settlement net, fees, tax, and refund deduction", () => {
    const command = buildSettlementPosting(event("settlement.reconciled", { batchId: 1, providerSettlementId: "set_m1_s1_001", grossAmountPaise: 95_000, netAmountPaise: 52_758, feePaise: 1_900, feeTaxPaise: 342, adjustmentPaise: -40_000, refundDeductionPaise: 40_000, adjustments: [], lineMatches: [{ settlementLineId: 1, matchStatus: "matched", paymentAttemptId: 5, refundId: null }, { settlementLineId: 2, matchStatus: "matched", paymentAttemptId: null, refundId: 42 }], utr: "UTR_1", providerReference: "fixture", settledAt: "2026-07-28T06:00:00.000Z" }));
    expect(command.lines.map(({ accountCode, side, amountPaise }) => [accountCode, side, amountPaise])).toEqual([["1010", "debit", 52_758], ["6000", "debit", 1_900], ["6010", "debit", 342], ["1100", "credit", 55_000]]);
  });

  it("rejects unresolved matches and mismatched settlement arithmetic", () => {
    const payload = { batchId: 1, providerSettlementId: "set_1", grossAmountPaise: 10_000, netAmountPaise: 9_000, feePaise: 500, feeTaxPaise: 90, adjustmentPaise: 0, refundDeductionPaise: 0, adjustments: [], lineMatches: [{ settlementLineId: 1, matchStatus: "mismatch", paymentAttemptId: 5, refundId: null }], utr: null, providerReference: "set_1", settledAt: "2026-07-28T06:00:00.000Z" };
    expect(() => buildSettlementPosting(event("settlement.reconciled", payload))).toThrowError(expect.objectContaining({ code: "SETTLEMENT_MATCH_REQUIRED" }));
    expect(() => buildSettlementPosting(event("settlement.reconciled", { ...payload, lineMatches: [{ ...payload.lineMatches[0], matchStatus: "matched" }] }))).toThrowError(expect.objectContaining({ code: "SETTLEMENT_TOTAL_MISMATCH" }));
  });

  it("rejects provider adjustments without an explicit account mapping", () => {
    expect(() => buildSettlementPosting(event("settlement.reconciled", { batchId: 1, providerSettlementId: "set_1", grossAmountPaise: 10_000, netAmountPaise: 10_100, feePaise: 0, feeTaxPaise: 0, adjustmentPaise: 100, refundDeductionPaise: 0, adjustments: [{ settlementLineId: 2, amountPaise: 100, providerEntityId: "adj_2" }], lineMatches: [{ settlementLineId: 2, matchStatus: "matched", paymentAttemptId: null, refundId: null }], utr: null, providerReference: "set_1", settledAt: "2026-07-28T06:00:00.000Z" }))).toThrowError(expect.objectContaining({ code: "SETTLEMENT_ADJUSTMENT_MAPPING_REQUIRED" }));
  });
});
