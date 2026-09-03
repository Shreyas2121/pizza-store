import { describe, expect, it } from "vitest";
import { idempotencyKeySchema, requestRefundSchema } from "./refund.schemas";

describe("refund request schema", () => {
  it("accepts the finance API allocation contract", () => {
    expect(requestRefundSchema.parse({
      reasonCode: "customer_cancellation",
      reasonNote: "Cancelled before preparation",
      amountPaise: 45_000,
      allocations: [
        { orderItemId: 12, quantity: 1, allocatedPaise: 40_000 },
        { type: "delivery_fee", allocatedPaise: 5_000 },
      ],
    }).amountPaise).toBe(45_000);
  });

  it("requires a UUID idempotency key and integer paise", () => {
    expect(() => idempotencyKeySchema.parse("retry-me")).toThrow();
    expect(() => requestRefundSchema.parse({
      reasonCode: "damaged",
      amountPaise: 100.5,
      allocations: [{ type: "delivery_fee", allocatedPaise: 100.5 }],
    })).toThrow();
  });
});
