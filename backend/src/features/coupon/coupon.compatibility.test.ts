import { describe, expect, it } from "vitest";
import { toLegacyCouponValidationResponse } from "./coupon.compatibility";

describe("legacy coupon validation response", () => {
  it("preserves coupon fields and adds exact quote fields", () => {
    const coupon = {
      id: 7,
      code: "SAVE10",
      discountType: "percentage" as const,
      discountRateBps: 1_000,
      discountAmountPaise: null,
      minimumOrderPaise: 10_000,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-09-01T00:00:00.000Z"),
      isActive: true,
      redemptionCount: 2,
      maxRedemptions: 100,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    };
    const response = toLegacyCouponValidationResponse(coupon, {
      quoteVersion: "2026-08-31-01",
      currency: "INR",
      pricingPolicyVersion: 1,
      itemsSubtotalPaise: 20_000,
      discountPaise: 2_000,
      deliveryFeePaise: 0,
      roundingAdjustmentPaise: 0,
      grandTotalPaise: 18_000,
      items: [],
      coupon: { id: 7, code: "SAVE10", discountPaise: 2_000, applied: true },
    });

    expect(response).toMatchObject({
      discountValue: 10,
      minOrderValue: 100,
      quoteVersion: "2026-08-31-01",
      currency: "INR",
      pricingPolicyVersion: 1,
      itemsSubtotalPaise: 20_000,
      discountPaise: 2_000,
      discountAmount: 20,
      grandTotalPaise: 18_000,
    });
  });
});
