import { describe, expect, it } from "vitest";
import {
  assertRefundCapacity,
  buildRefundAllocations,
  requireRefundStatus,
} from "./refund.policy";

const item = {
  id: 12,
  quantity: 2,
  lineTotalPaise: 40_000,
  discountAllocationPaise: 4_000,
  taxRateBps: 500,
};

describe("refund policy", () => {
  it("builds immutable item and delivery tax allocations in paise", () => {
    const result = buildRefundAllocations({
      input: {
        reasonCode: "customer_cancellation",
        amountPaise: 25_000,
        allocations: [
          { orderItemId: 12, quantity: 1, allocatedPaise: 20_000 },
          { type: "delivery_fee", allocatedPaise: 5_000 },
        ],
      },
      orderItems: [item],
      deliveryFeePaise: 5_000,
      deliveryTaxRateBps: 1800,
      existing: [],
    });

    expect(result).toEqual([
      {
        kind: "item", orderItemId: 12, quantity: 1, amountPaise: 20_000,
        taxableAmountPaise: 19_048, taxPaise: 952, discountReversalPaise: 2_000,
      },
      {
        kind: "delivery_fee", orderItemId: null, quantity: null, amountPaise: 5_000,
        taxableAmountPaise: 4_237, taxPaise: 763, discountReversalPaise: 0,
      },
    ]);
  });

  it("rejects cumulative item quantity and delivery over-allocation", () => {
    expect(() => buildRefundAllocations({
      input: {
        reasonCode: "damaged",
        amountPaise: 25_001,
        allocations: [
          { orderItemId: 12, quantity: 2, allocatedPaise: 20_001 },
          { type: "delivery_fee", allocatedPaise: 5_000 },
        ],
      },
      orderItems: [item],
      deliveryFeePaise: 5_000,
      deliveryTaxRateBps: 1800,
      existing: [{ kind: "item", orderItemId: 12, quantity: 1, amountPaise: 20_000 }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_REFUND_ALLOCATION", status: 422 }));
  });

  it("enforces captured capacity including reserved failed refunds", () => {
    expect(() => assertRefundCapacity(45_000, 40_000, 5_001))
      .toThrowError(expect.objectContaining({ code: "REFUND_EXCEEDS_CAPTURED_AMOUNT", status: 422 }));
    expect(() => assertRefundCapacity(45_000, 40_000, 5_000)).not.toThrow();
  });

  it("rejects invalid aggregate transitions", () => {
    expect(() => requireRefundStatus("processed", "requested"))
      .toThrowError(expect.objectContaining({ code: "INVALID_STATE_TRANSITION", status: 409 }));
  });
});
