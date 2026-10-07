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
  taxPaise: 1_905,
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
      deliveryTaxPaise: 763,
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
      deliveryTaxPaise: 763,
      existing: [{ kind: "item", orderItemId: 12, quantity: 1, amountPaise: 20_000, taxPaise: 952 }],
    })).toThrowError(expect.objectContaining({ code: "INVALID_REFUND_ALLOCATION", status: 422 }));
  });

  it("exhausts paid tax exactly across split refunds instead of rounding each refund again", () => {
    const refund = (amount: number, existing: { kind: "item"; orderItemId: number; quantity: number; amountPaise: number; taxPaise: number }[]) => buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: amount, allocations: [{ orderItemId: 12, quantity: 1, allocatedPaise: amount }] },
      orderItems: [{ ...item, lineTotalPaise: 22, taxPaise: 1, discountAllocationPaise: 0 }],
      deliveryFeePaise: 0, deliveryTaxRateBps: 500, deliveryTaxPaise: 0, existing,
    })[0];
    const first = refund(11, []);
    const second = refund(11, [{ kind: "item", orderItemId: 12, quantity: 1, amountPaise: 11, taxPaise: first.taxPaise }]);
    expect(first.taxPaise + second.taxPaise).toBe(1);
    expect(first.taxableAmountPaise + second.taxableAmountPaise).toBe(21);
  });

  it("allows the final quantity to refund the odd paid-line remainder", () => {
    expect(buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: 11, allocations: [{ orderItemId: 12, quantity: 1, allocatedPaise: 11 }] },
      orderItems: [{ ...item, lineTotalPaise: 21, taxPaise: 1 }],
      deliveryFeePaise: 0, deliveryTaxRateBps: 500, deliveryTaxPaise: 0,
      existing: [{ kind: "item", orderItemId: 12, quantity: 1, amountPaise: 10, taxPaise: 0 }],
    })[0]).toMatchObject({ amountPaise: 11, taxPaise: 1, taxableAmountPaise: 10 });
  });

  it("does not reverse negative tax after an earlier reservation is released", () => {
    expect(buildRefundAllocations({
      input: { reasonCode: "damaged", amountPaise: 1, allocations: [{ type: "delivery_fee", allocatedPaise: 1 }] },
      orderItems: [], deliveryFeePaise: 22, deliveryTaxRateBps: 500, deliveryTaxPaise: 1,
      existing: [{ kind: "delivery_fee", orderItemId: null, quantity: null, amountPaise: 11, taxPaise: 1 }],
    })[0]).toMatchObject({ taxPaise: 0, taxableAmountPaise: 1 });
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
