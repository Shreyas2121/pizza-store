import { describe, expect, it, vi } from "vitest";
import type { TransactionType } from "../../utils/types";
import {
  PRICING_POLICY_VERSION,
  buildRecognitionPricingSnapshot,
  PricingService,
  QUOTE_VERSION,
  type BuildPricingQuoteOptions,
  type PricingItemInput,
  type PricingRepository,
} from "./pricing.service";

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

type CouponRecord = NonNullable<
  Awaited<ReturnType<PricingRepository["findCoupon"]>>
>;
type DeliveryPricingRule = Awaited<
  ReturnType<PricingRepository["findDeliveryPricingRules"]>
>[number];
type TaxRule = Awaited<
  ReturnType<PricingRepository["findTaxRules"]>
>[number];

const now = new Date("2026-08-31T10:00:00.000Z");

const coupon = (overrides: Partial<CouponRecord> = {}): CouponRecord => ({
  id: 7,
  code: "SAVE10",
  discountType: "percentage",
  discountValue: 10,
  minOrderValue: 0,
  startDate: new Date("2026-08-01T00:00:00.000Z"),
  endDate: new Date("2026-09-30T23:59:59.000Z"),
  isActive: true,
  redemptionCount: 0,
  maxRedemptions: -1,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

const deliveryRule = (
  overrides: Partial<DeliveryPricingRule> = {}
): DeliveryPricingRule => ({
  id: 11,
  storeId: 1,
  version: 3,
  deliveryFeePaise: 4_000,
  freeDeliveryThresholdPaise: 50_000,
  effectiveFrom: "2026-08-01",
  effectiveTo: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

const taxRule = (component: "item" | "delivery", overrides: Partial<TaxRule> = {}): TaxRule => ({
  id: component === "item" ? 21 : 22,
  storeId: 1,
  component,
  version: 2,
  rateBps: 500,
  hsnSacCode: component === "item" ? "21069099-DEMO" : "996331-DEMO",
  isDemo: true,
  disclaimer: "Portfolio demo — not a statutory tax invoice",
  effectiveFrom: "2026-08-01",
  effectiveTo: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

const items: PricingItemInput[] = [
  {
    lineId: 2,
    productId: 20,
    productName: "Custom pizza",
    quantity: 2,
    baseUnitPricePaise: 10_000,
    customizations: [
      { customizationOptionId: 3, name: "Cheese", pricePaise: 500 },
    ],
  },
  {
    lineId: 1,
    productId: 10,
    productName: "Pizza",
    quantity: 1,
    baseUnitPricePaise: 9_000,
    customizations: [],
  },
];

const createHarness = (
  couponRecord: CouponRecord | null = coupon(),
  activeUses = 0,
  rules: DeliveryPricingRule[] = [deliveryRule()],
  storeContext: { timezone: string; state: string } | undefined = {
    timezone: "Asia/Kolkata",
    state: "Maharashtra",
  },
  taxRules: TaxRule[] = [taxRule("item"), taxRule("delivery")]
) => {
  const repository: PricingRepository = {
    findCoupon: vi.fn(async () => couponRecord ?? undefined),
    countActiveCouponUses: vi.fn(async () => activeUses),
    findStorePricingContext: vi.fn(async () => storeContext),
    findDeliveryPricingRules: vi.fn(async () => rules),
    findTaxRules: vi.fn(async (_storeId, component) =>
      taxRules.filter((rule) => rule.component === component)
    ),
  };
  return { service: new PricingService(repository), repository };
};

describe("PricingService", () => {
  it("builds a versioned paise quote and deterministically allocates discount", async () => {
    const { service } = createHarness();

    const result = await service.buildQuote({
      storeId: 1,
      items,
      couponCode: " save10 ",
      now,
    });

    expect(result.quote).toMatchObject({
      quoteVersion: QUOTE_VERSION,
      currency: "INR",
      pricingPolicyVersion: PRICING_POLICY_VERSION,
      itemsSubtotalPaise: 30_000,
      discountPaise: 3_000,
      deliveryFeePaise: 4_000,
      roundingAdjustmentPaise: 0,
      grandTotalPaise: 31_000,
      taxableAmountPaise: 29_524,
      taxPaise: 1_476,
      coupon: {
        id: 7,
        code: "SAVE10",
        discountPaise: 3_000,
        applied: true,
      },
      deliveryPricing: {
        ruleId: 11,
        ruleVersion: 3,
        storeId: 1,
        businessDate: "2026-08-31",
        timezone: "Asia/Kolkata",
        standardFeePaise: 4_000,
        freeDeliveryThresholdPaise: 50_000,
        freeDeliveryApplied: false,
      },
      tax: {
        calculationPolicyVersion: 1,
        isDemo: true,
        disclaimer: "Portfolio demo — not a statutory tax invoice",
        placeOfSupplyState: "Maharashtra",
        placeOfSupplySource: "store_estimate",
        itemRule: {
          ruleId: 21,
          ruleVersion: 2,
          rateBps: 500,
          hsnSacCode: "21069099-DEMO",
        },
        deliveryRule: {
          ruleId: 22,
          ruleVersion: 2,
          rateBps: 500,
          hsnSacCode: "996331-DEMO",
          taxableAmountPaise: 3_810,
          taxPaise: 190,
        },
      },
    });
    expect(result.quote.items).toEqual([
      expect.objectContaining({
        lineId: 2,
        unitPricePaise: 10_500,
        lineSubtotalPaise: 21_000,
        discountAllocationPaise: 2_100,
        lineTotalPaise: 18_900,
        taxableAmountPaise: 18_000,
        taxPaise: 900,
      }),
      expect.objectContaining({
        lineId: 1,
        unitPricePaise: 9_000,
        lineSubtotalPaise: 9_000,
        discountAllocationPaise: 900,
        lineTotalPaise: 8_100,
        taxableAmountPaise: 7_714,
        taxPaise: 386,
      }),
    ]);
    expect(
      result.quote.items.reduce(
        (sum, item) => sum + item.discountAllocationPaise,
        0
      )
    ).toBe(result.quote.discountPaise);
    expect(
      result.quote.items.reduce((sum, item) => sum + item.lineTotalPaise, 0)
    ).toBe(result.quote.grandTotalPaise - result.quote.deliveryFeePaise);
    expect(
      result.quote.items.reduce((sum, item) => sum + item.taxPaise, 0)
      + result.quote.tax.deliveryRule.taxPaise
    ).toBe(result.quote.taxPaise);
    expect(result.quote.taxableAmountPaise + result.quote.taxPaise).toBe(
      result.quote.grandTotalPaise
    );
  });

  it("uses half-away-from-zero percentage rounding and caps fixed discounts", async () => {
    const percentage = createHarness(coupon({ discountValue: 50 }));
    const oneLine = [{ ...items[1], baseUnitPricePaise: 101 }];
    await expect(
      percentage.service.buildQuote({ storeId: 1, items: oneLine, couponCode: "SAVE10", now })
    ).resolves.toMatchObject({
      quote: { itemsSubtotalPaise: 101, discountPaise: 51, grandTotalPaise: 4_050 },
    });

    const fixed = createHarness(
      coupon({ discountType: "fixed", discountValue: 500 })
    );
    await expect(
      fixed.service.buildQuote({ storeId: 1, items: oneLine, couponCode: "SAVE10", now })
    ).resolves.toMatchObject({
      quote: { discountPaise: 101, grandTotalPaise: 4_000 },
    });
  });

  it("returns the same quote for preview and transaction-locked checkout", async () => {
    const { service, repository } = createHarness();
    const tx = { testTransaction: true } as unknown as TransactionType;

    const preview = await service.buildQuote(
      { storeId: 1, items, couponCode: "save10", now },
      { lockCoupon: false }
    );
    const checkout = await service.buildQuote(
      { storeId: 1, items, couponCode: "save10", now },
      { executor: tx, lockCoupon: true }
    );

    expect(preview.quote).toEqual(checkout.quote);
    expect(repository.findCoupon).toHaveBeenNthCalledWith(
      1,
      "SAVE10",
      expect.objectContaining({ lock: false })
    );
    expect(repository.findCoupon).toHaveBeenNthCalledWith(
      2,
      "SAVE10",
      { executor: tx, lock: true }
    );
  });

  it("requires a caller transaction when coupon locking is requested", async () => {
    const { service, repository } = createHarness();
    await expect(
      service.buildQuote(
        { storeId: 1, items, couponCode: "SAVE10", now },
        { lockCoupon: true } as BuildPricingQuoteOptions
      )
    ).rejects.toMatchObject({
      status: 500,
      code: "PRICING_TRANSACTION_REQUIRED",
    });
    expect(repository.findCoupon).not.toHaveBeenCalled();
  });

  it.each([
    [null, 0, "Coupon not found", 404],
    [coupon({ isActive: false }), 0, "Coupon is not active", 400],
    [coupon({ startDate: new Date("2026-09-01T00:00:00.000Z") }), 0, "Coupon is expired or not yet valid", 400],
    [coupon({ minOrderValue: 301 }), 0, "Minimum order value of 301 not met", 400],
    [coupon({ maxRedemptions: 2, redemptionCount: 0 }), 2, "Coupon maximum redemption limit reached", 400],
  ] as const)(
    "rejects invalid coupon context %#",
    async (couponRecord, activeUses, message, status) => {
      const { service } = createHarness(couponRecord, activeUses);
      await expect(
        service.buildQuote({ storeId: 1, items, couponCode: "SAVE10", now })
      ).rejects.toMatchObject({ message, status });
    }
  );

  it("rejects duplicate lines and bounded order overflow", async () => {
    const { service } = createHarness();
    await expect(
      service.buildQuote({ storeId: 1, items: [items[0], items[0]] })
    ).rejects.toMatchObject({
      message: "Cart contains duplicate line identifiers",
      status: 409,
    });
    await expect(
      service.buildQuote({
        storeId: 1,
        items: Array.from({ length: 6 }, (_, index) => ({
          ...items[1],
          lineId: index + 1,
          baseUnitPricePaise: 100_000,
        })),
      })
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Cart total is too large",
        status: 400,
      })
    );
  });

  it("applies free delivery to the post-discount item value at the threshold", async () => {
    const { service } = createHarness(null, 0, [
      deliveryRule({ freeDeliveryThresholdPaise: 30_000 }),
    ]);

    const result = await service.buildQuote({ storeId: 1, items, now });

    expect(result.quote).toMatchObject({
      deliveryFeePaise: 0,
      grandTotalPaise: 30_000,
      deliveryPricing: { freeDeliveryApplied: true },
    });
  });

  it("selects rules using the store-local business date", async () => {
    const { service, repository } = createHarness(null);

    await service.buildQuote({
      storeId: 1,
      items,
      now: new Date("2026-08-31T18:30:00.000Z"),
    });

    expect(repository.findDeliveryPricingRules).toHaveBeenCalledWith(
      1,
      "2026-09-01",
      expect.objectContaining({ lock: false })
    );
  });

  it("uses delivery address state as place of supply without changing inclusive totals", async () => {
    const { service } = createHarness(null);
    const result = await service.buildQuote({
      storeId: 1,
      items,
      destinationState: "Karnataka",
      now,
    });
    expect(result.quote.grandTotalPaise).toBe(34_000);
    expect(result.quote.tax).toMatchObject({
      placeOfSupplyState: "Karnataka",
      placeOfSupplySource: "delivery_address",
    });
    expect(result.quote.taxableAmountPaise + result.quote.taxPaise).toBe(
      result.quote.grandTotalPaise
    );
  });

  it.each([
    [[], "TAX_RULE_NOT_FOUND", 422],
    [[taxRule("item"), taxRule("item", { id: 23, version: 3 })], "TAX_RULE_OVERLAP", 500],
  ] as const)("rejects invalid item tax rule selection %#", async (itemRules, code, status) => {
    const { service } = createHarness(
      null,
      0,
      [deliveryRule()],
      { timezone: "Asia/Kolkata", state: "Maharashtra" },
      [...itemRules, taxRule("delivery")]
    );
    await expect(service.buildQuote({ storeId: 1, items, now })).rejects.toMatchObject({
      code,
      status,
    });
  });

  it.each([
    [[], "DELIVERY_PRICING_RULE_NOT_FOUND", 422],
    [[deliveryRule(), deliveryRule({ id: 12, version: 4 })], "DELIVERY_PRICING_RULE_OVERLAP", 500],
  ] as const)("rejects invalid delivery rule selection %#", async (rules, code, status) => {
    const { service } = createHarness(null, 0, [...rules]);
    await expect(service.buildQuote({ storeId: 1, items, now })).rejects.toMatchObject({
      code,
      status,
    });
  });
});
