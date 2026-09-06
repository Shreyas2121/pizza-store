import { describe, expect, it, vi } from "vitest";
import { CommercePostingService } from "./commerce-posting.service";

describe("commerce posting service", () => {
  it("registers the implemented commerce, refund, settlement, cash, and expense events", () => {
    const service = new CommercePostingService({} as never);
    expect(service.supportedEventTypes).toEqual([
      "payment_attempt.captured", "order.delivered", "order.recognition_reversed",
      "refund.processed", "refund.failed", "refund.disbursed", "settlement.reconciled",
      "cash.movement_recorded", "cash.session_closed", "cash.session_reopened",
      "expense.paid", "expense.posted", "expense.voided", "expense.reversed",
    ]);
    expect(service.supportedEventTypes).not.toContain("payment_attempt.failed");
    expect(service.supportedEventTypes).not.toContain("order.out_for_delivery" as never);
  });

  it("routes collection and recognition to the balanced kernel", async () => {
    const ledger = { post: vi.fn().mockResolvedValue({ id: 1 }), reverseSource: vi.fn() };
    const service = new CommercePostingService(ledger as never);
    const common = {
      id: 1, eventId: "evt", schemaVersion: 1, sourceVersion: 1, storeId: 1, currency: "INR",
      occurredAt: new Date("2026-09-06T08:00:00.000Z"), businessDate: "2026-09-06",
      timezone: "Asia/Kolkata", actorId: null, correlationId: null, causationId: null,
      payloadHash: "a".repeat(64), status: "processing", attemptCount: 1, availableAt: new Date(),
      claimedAt: new Date(), claimedBy: "worker", processedAt: null, lastError: null, createdAt: new Date(), updatedAt: new Date(),
    } as const;
    await service.process({ ...common, eventType: "payment_attempt.captured", sourceType: "payment_attempt", sourceId: "4", payload: {
      paymentAttemptId: 4, orderId: 8, provider: "cod", method: "cash", capturedPaise: 10_000,
      capturedAt: "2026-09-06T08:00:00.000Z", cashSessionId: 2,
    } });
    expect(ledger.post).toHaveBeenCalledWith(expect.objectContaining({ description: "COD collection for order 8" }));
  });
});
