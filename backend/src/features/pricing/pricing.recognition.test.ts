import { describe, expect, it } from "vitest";
import { buildRecognitionPricingSnapshot } from "./pricing.recognition";

describe("recognition pricing snapshot", () => {
  it("derives tax-exclusive discount components from immutable priced lines", () => {
    expect(buildRecognitionPricingSnapshot({
      lines: [{ lineSubtotalPaise: 10_500, taxableAmountPaise: 9_000, taxPaise: 450, taxRateBps: 500 }],
      deliveryTaxableAmountPaise: 0,
      deliveryTaxPaise: 0,
      totalTaxPaise: 450,
    })).toEqual({
      preDiscountTaxableFoodPaise: 10_000,
      discountContraPaise: 1_000,
      taxableDeliveryPaise: 0,
      itemTaxPaise: 450,
      deliveryTaxPaise: 0,
    });
  });

  it("rejects a recognition snapshot whose stored tax totals disagree", () => {
    expect(() => buildRecognitionPricingSnapshot({
      lines: [{ lineSubtotalPaise: 10_500, taxableAmountPaise: 9_000, taxPaise: 450, taxRateBps: 500 }],
      deliveryTaxableAmountPaise: 0,
      deliveryTaxPaise: 0,
      totalTaxPaise: 451,
    })).toThrowError(expect.objectContaining({ code: "ORDER_RECOGNITION_MISMATCH" }));
  });
});
