import { describe, expect, it } from "vitest";
import type { FinancialOutboxEvent } from "../../db/schema";
import {
  buildCapturedPaymentPosting,
  buildDeliveredOrderPosting,
  buildRecognitionReversal,
} from "./commerce-posting.policy";

const event = (eventType: FinancialOutboxEvent["eventType"], payload: Record<string, unknown>): FinancialOutboxEvent => ({
  id: 1,
  eventId: "evt-1",
  eventType,
  schemaVersion: 1,
  sourceType: eventType.startsWith("order.") ? "order" : "payment_attempt",
  sourceId: "42",
  sourceVersion: 1,
  storeId: 2,
  currency: "INR",
  occurredAt: new Date("2026-09-06T08:00:00.000Z"),
  businessDate: "2026-09-06",
  timezone: "Asia/Kolkata",
  actorId: 7,
  correlationId: "corr-1",
  causationId: null,
  payload,
  payloadHash: "a".repeat(64),
  status: "processing",
  attemptCount: 1,
  availableAt: new Date(),
  claimedAt: new Date(),
  claimedBy: "worker",
  processedAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("commerce posting policy", () => {
  it("posts online capture to clearing and customer advances without recognizing revenue", () => {
    const command = buildCapturedPaymentPosting(event("payment_attempt.captured", {
      paymentAttemptId: 12,
      orderId: 42,
      provider: "razorpay",
      method: "upi",
      capturedPaise: 52_500,
      capturedAt: "2026-09-06T08:00:00.000Z",
      providerReference: "pay_demo_12",
    }));
    expect(command.lines).toEqual([
      expect.objectContaining({ accountCode: "1100", side: "debit", amountPaise: 52_500 }),
      expect.objectContaining({ accountCode: "2000", side: "credit", amountPaise: 52_500 }),
    ]);
    expect(command.lines.map((line) => line.accountCode)).not.toEqual(expect.arrayContaining(["4000", "4010", "2200", "5000"]));
  });

  it("posts COD collection to cash only when a session identity is present", () => {
    const command = buildCapturedPaymentPosting(event("payment_attempt.captured", {
      paymentAttemptId: 13,
      orderId: 43,
      provider: "cod",
      method: "cash",
      capturedPaise: 35_000,
      capturedAt: "2026-09-06T08:00:00.000Z",
      cashSessionId: 4,
    }));
    expect(command.lines[0]).toMatchObject({ accountCode: "1000", side: "debit", amountPaise: 35_000 });
  });

  it("builds a balanced delivery journal with inclusive tax, discount, and COGS", () => {
    const command = buildDeliveredOrderPosting(event("order.delivered", {
      orderId: 42,
      pricingPolicyVersion: 1,
      customerTotalPaise: 9_450,
      preDiscountTaxableFoodPaise: 10_000,
      discountContraPaise: 1_000,
      taxableDeliveryPaise: 0,
      itemTaxPaise: 450,
      deliveryTaxPaise: 0,
      roundingAdjustmentPaise: 0,
      lineCostSnapshots: [{
        orderItemId: 5, productId: 8, quantity: 1, costVersionId: 3,
        unitCostPaise: 1_800, lineCostPaise: 1_800,
      }],
      deliveredAt: "2026-09-06T08:00:00.000Z",
    }));
    const debits = command.lines.filter((line) => line.side === "debit").reduce((sum, line) => sum + line.amountPaise, 0);
    const credits = command.lines.filter((line) => line.side === "credit").reduce((sum, line) => sum + line.amountPaise, 0);
    expect(debits).toBe(12_250);
    expect(credits).toBe(debits);
    expect(command.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: "2000", side: "debit", amountPaise: 9_450 }),
      expect.objectContaining({ accountCode: "4100", side: "debit", amountPaise: 1_000 }),
      expect.objectContaining({ accountCode: "5000", side: "debit", amountPaise: 1_800 }),
      expect.objectContaining({ accountCode: "4000", side: "credit", amountPaise: 10_000 }),
      expect.objectContaining({ accountCode: "2200", side: "credit", amountPaise: 450 }),
      expect.objectContaining({ accountCode: "1200", side: "credit", amountPaise: 1_800 }),
    ]));
  });

  it("carries the original source identity into an authorized exact reversal", () => {
    const result = buildRecognitionReversal(event("order.recognition_reversed", {
      orderId: 42,
      originalRecognitionSource: { sourceType: "order", sourceId: 42, eventType: "order.delivered", sourceVersion: 1 },
      correctionId: "correction-42",
      reason: "Delivery was recorded in error",
      authorizedActorId: 7,
      effectiveBusinessDate: "2026-09-06",
    }));
    expect(result.originalSource).toEqual({ sourceType: "order", sourceId: 42, eventType: "order.delivered", sourceVersion: 1 });
    expect(result.reversal.source).toEqual({ sourceType: "order", sourceId: "42", eventType: "order.recognition_reversed", sourceVersion: 1 });
  });

  it("rejects malformed event payloads before ledger mutation", () => {
    expect(() => buildCapturedPaymentPosting(event("payment_attempt.captured", {
      paymentAttemptId: 12, orderId: 42, provider: "razorpay", method: "upi", capturedPaise: 100,
      capturedAt: "2026-09-06T08:00:00.000Z",
    }))).toThrowError(expect.objectContaining({ code: "INVALID_POSTING_EVENT" }));
  });
});
