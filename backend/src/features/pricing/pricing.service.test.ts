import { describe, expect, it, vi } from "vitest";
import { DEMO_TAX_DISCLAIMER } from "../../db/schema";
import {
  PricingService,
  QUOTE_VERSION,
  PRICING_POLICY_VERSION,
  type PricingItemInput,
  type PricingRepository,
  type PromotionPricingSource,
} from "./pricing.service";
import type { PromotionRecord, PromotionUsageContext } from "../promotions";
import type { TransactionType } from "../../utils/types";

const now = new Date("2026-09-15T12:00:00Z");
export const pricingItem = (
  overrides: Partial<PricingItemInput> = {},
): PricingItemInput => ({
  lineId: 1,
  productId: 11,
  categoryId: 5,
  productName: "Pizza",
  quantity: 1,
  baseUnitPricePaise: 10_000,
  customizations: [
    { customizationOptionId: 7, name: "Cheese", pricePaise: 2_000 },
  ],
  ...overrides,
});
const promotion = (
  overrides: Partial<PromotionRecord> = {},
): PromotionRecord => ({
  id: 1,
  definitionVersion: 2,
  kind: "offer",
  name: "Offer",
  code: null,
  discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: null },
  scope: "cart",
  includeCustomizationValue: false,
  minimumOrderPaise: 0,
  minimumCartQuantity: 0,
  firstOrderOnly: false,
  startsAt: new Date("2026-01-01"),
  endsAt: new Date("2027-01-01"),
  activeDaysOfWeek: null,
  activeStartTime: null,
  activeEndTime: null,
  perUserRedemptionLimit: null,
  maxRedemptions: null,
  totalDiscountBudgetPaise: null,
  displayPriority: 0,
  rules: [],
  isActive: true,
  ...overrides,
});
export const pricingHarness = (
  definitions: PromotionRecord[] = [],
  usage: Partial<PromotionUsageContext> = {},
  qualifyingOrderCount = 0,
) => {
  const delivery = {
    id: 11,
    storeId: 1,
    version: 3,
    deliveryFeePaise: 4_000,
    freeDeliveryThresholdPaise: 50_000 as number | null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    createdAt: now,
    updatedAt: now,
  };
  const repository: PricingRepository = {
    findStorePricingContext: vi.fn(async () => ({
      timezone: "Asia/Kolkata",
      state: "Karnataka",
    })),
    findDeliveryPricingRules: vi.fn(async () => [delivery]),
    findTaxRules: vi.fn(async (_store, component) => [
      {
        id: component === "item" ? 21 : 22,
        storeId: 1,
        component,
        version: 2,
        rateBps: component === "item" ? 500 : 1_800,
        hsnSacCode: "DEMO",
        isDemo: true,
        disclaimer: DEMO_TAX_DISCLAIMER,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        createdAt: now,
        updatedAt: now,
      },
    ]),
  };
  const source: PromotionPricingSource = {
    load: vi.fn(async () => ({
      promotions: definitions,
      qualifyingOrderCount,
      usageByPromotionId: Object.fromEntries(
        definitions.map((definition) => [
          definition.id,
          {
            storeEnabled: true,
            globalRedemptionsUsed: 0,
            userRedemptionsUsed: 0,
            budgetUsedPaise: 0,
            ...usage,
          },
        ]),
      ),
    })),
  };
  return {
    service: new PricingService(repository, source),
    repository,
    source,
    delivery,
  };
};
const quote = async (
  h: ReturnType<typeof pricingHarness>,
  items = [pricingItem()],
  couponCode?: string,
) =>
  (
    await h.service.buildQuote({
      storeId: 1,
      userId: 7,
      items,
      couponCode,
      now,
    })
  ).quote;
const reconcile = (q: Awaited<ReturnType<typeof quote>>) => {
  expect(q.items.reduce((sum, item) => sum + item.itemDiscountPaise, 0)).toBe(
    q.itemDiscountPaise,
  );
  expect(q.promotions.reduce((sum, p) => sum + p.totalSavingsPaise, 0)).toBe(
    q.promotionSavingsPaise,
  );
  expect(q.standardDeliveryFeePaise - q.chargedDeliveryFeePaise).toBe(
    q.deliveryDiscountPaise,
  );
  expect(
    q.itemsSubtotalPaise - q.itemDiscountPaise + q.chargedDeliveryFeePaise,
  ).toBe(q.grandTotalPaise);
  expect(q.taxableAmountPaise + q.taxPaise).toBe(q.grandTotalPaise);
  expect(q.promotionSavingsPaise + q.bundleMarkdownPaise).toBe(
    q.totalDisplayedSavingsPaise,
  );
  for (const p of q.promotions)
    expect(p.allocations.reduce((sum, a) => sum + a.amountPaise, 0)).toBe(
      p.totalSavingsPaise,
    );
  for (const item of q.items) {
    expect(item.lineTotalPaise).toBeGreaterThanOrEqual(0);
    expect(item.taxableAmountPaise + item.taxPaise).toBe(item.lineTotalPaise);
  }
};
describe("promotion pricing v5", () => {
  it("returns the frozen shape and charges delivery below the store threshold", async () => {
    const q = await quote(pricingHarness());
    expect(q).toMatchObject({
      quoteVersion: QUOTE_VERSION,
      pricingPolicyVersion: PRICING_POLICY_VERSION,
      discountMode: "none",
      itemDiscountPaise: 0,
      standardDeliveryFeePaise: 4_000,
      chargedDeliveryFeePaise: 4_000,
    });
    expect(q).not.toHaveProperty("coupon");
    expect(q).not.toHaveProperty("discountPaise");
    expect(q).not.toHaveProperty("deliveryFeePaise");
    reconcile(q);
  });
  it.each([[49_999, 4_000], [50_000, 0], [74_700, 0]] as const)(
    "applies the store free-delivery threshold to subtotal %i",
    async (subtotal, expectedFee) => {
      const q = await quote(pricingHarness(), [pricingItem({ baseUnitPricePaise: subtotal, customizations: [] })]);
      expect(q.standardDeliveryFeePaise).toBe(expectedFee);
      expect(q.chargedDeliveryFeePaise).toBe(expectedFee);
      expect(q.grandTotalPaise).toBe(subtotal + expectedFee);
      expect(q.deliveryDiscountPaise).toBe(0);
      if (expectedFee === 0) expect(q.tax.deliveryRule.taxPaise).toBe(0);
      reconcile(q);
    },
  );
  it.each([[null, 4_000], [0, 0]] as const)(
    "handles a %s free-delivery threshold explicitly",
    async (threshold, fee) => {
      const h = pricingHarness(); h.delivery.freeDeliveryThresholdPaise = threshold;
      expect((await quote(h)).chargedDeliveryFeePaise).toBe(fee);
    },
  );
  it("uses the pre-discount subtotal and avoids inventing delivery promotion savings when delivery is already free", async () => {
    const h = pricingHarness([
      promotion({ discount: { type: "percentage", rateBps: 1000, maxDiscountPaise: null } }),
      promotion({ id: 2, discount: { type: "free_delivery" }, scope: "delivery" }),
    ]);
    const q = await quote(h, [pricingItem({ baseUnitPricePaise: 50_000, customizations: [] })]);
    expect(q.itemDiscountPaise).toBe(5000);
    expect(q.grandTotalPaise).toBe(45_000);
    expect(q.chargedDeliveryFeePaise).toBe(0);
    expect(q.deliveryDiscountPaise).toBe(0);
    expect(q.promotions.find((p) => p.id === 2)).toBeUndefined();
    reconcile(q);
  });
  it.each([
    ["percentage", promotion(), 1_000, 0],
    [
      "fixed_amount",
      promotion({ discount: { type: "fixed_amount", amountPaise: 3_000 } }),
      3_000,
      0,
    ],
    [
      "free_delivery",
      promotion({ discount: { type: "free_delivery" }, scope: "delivery" }),
      0,
      4_000,
    ],
    [
      "tiered",
      promotion({
        discount: { type: "tiered" },
        rules: [
          {
            type: "tier",
            minimumSubtotalPaise: 0,
            discount: { type: "fixed_amount", amountPaise: 500 },
          },
          {
            type: "tier",
            minimumSubtotalPaise: 12_000,
            discount: { type: "fixed_amount", amountPaise: 2_000 },
          },
        ],
      }),
      2_000,
      0,
    ],
    [
      "buy_x_get_y",
      promotion({
        scope: "product",
        discount: { type: "buy_x_get_y" },
        rules: [
          {
            type: "buy_x_get_y",
            buyQuantity: 1,
            getQuantity: 1,
            buyProductIds: [11],
            buyCategoryIds: [],
            getProductIds: [11],
            getCategoryIds: [],
          },
        ],
      }),
      10_000,
      0,
    ],
  ] as const)(
    "resolves %s and tax through the quote",
    async (_type, definition, itemSaving, deliverySaving) => {
      const q = await quote(pricingHarness([definition]), [
        pricingItem({
          quantity: definition.discount.type === "buy_x_get_y" ? 2 : 1,
        }),
      ]);
      expect(q.itemDiscountPaise).toBe(itemSaving);
      expect(q.deliveryDiscountPaise).toBe(deliverySaving);
      expect(q.discountMode).toBe("automatic_deals");
      expect(q.promotions[0]).toMatchObject({
        definitionVersion: 2,
        applied: true,
        code: null,
      });
      reconcile(q);
    },
  );
  it("keeps customizations outside the basis unless explicitly included and recomputes inclusive tax", async () => {
    const q = await quote(pricingHarness([promotion()]));
    expect(q.items[0]).toMatchObject({
      baseUnitPricePaise: 10_000,
      customizationUnitPricePaise: 2_000,
      lineTotalPaise: 11_000,
      taxableAmountPaise: 10_476,
      taxPaise: 524,
    });
    expect(
      (
        await quote(
          pricingHarness([promotion({ includeCustomizationValue: true })]),
        )
      ).itemDiscountPaise,
    ).toBe(1_200);
    reconcile(q);
  });
  it("applies distinct product/category offers and breaks ties by priority then ID", async () => {
    const q = await quote(
      pricingHarness([
        promotion({
          id: 5,
          scope: "product",
          rules: [{ type: "product_include", productId: 11 }],
        }),
        promotion({
          id: 3,
          displayPriority: 1,
          scope: "product",
          rules: [{ type: "product_include", productId: 11 }],
        }),
        promotion({
          id: 2,
          displayPriority: 1,
          scope: "product",
          rules: [{ type: "product_include", productId: 11 }],
        }),
        promotion({
          id: 8,
          scope: "category",
          rules: [{ type: "category_include", categoryId: 8 }],
        }),
      ]),
      [
        pricingItem(),
        pricingItem({
          lineId: 2,
          productId: 20,
          categoryId: 8,
          customizations: [],
        }),
      ],
    );
    expect(q.promotions.map((p) => p.id)).toEqual([2, 8]);
    expect(q.couponEligibility.conflictingLineIds).toEqual([1, 2]);
    reconcile(q);
  });
  it("normalizes only the supplied manual coupon and never applies other coupons", async () => {
    const h = pricingHarness([
      promotion({ kind: "coupon", code: "SAVE", name: "Coupon" }),
      promotion({ id: 2, kind: "coupon", code: "HIDDEN" }),
    ]);
    expect((await quote(h)).promotions).toEqual([]);
    const q = await quote(h, [pricingItem()], " save ");
    expect(q.discountMode).toBe("coupon");
    expect(q.promotions).toHaveLength(1);
    expect(h.source.load).toHaveBeenLastCalledWith(1, 7, "SAVE", now, {});
    reconcile(q);
  });
  it.each([
    promotion(),
    promotion({ scope: "delivery", discount: { type: "free_delivery" } }),
  ])(
    "rejects coupons while any automatic offer applies",
    async (definition) => {
      await expect(
        quote(pricingHarness([definition]), [pricingItem()], "MISSING"),
      ).rejects.toMatchObject({
        code: "COUPON_NOT_COMBINABLE_WITH_OFFERS",
        data: {
          couponEligibility: { eligible: false, reasonCode: "OFFER_APPLIED" },
        },
      });
    },
  );
  const bundle = pricingItem({
    productType: "bundle",
    baseUnitPricePaise: 10_000,
    customizations: [],
    compareAtUnitPricePaise: 15_000,
    bundleComponents: [
      {
        productId: 20,
        name: "Drink",
        quantityPerBundle: 1,
        totalQuantity: 1,
        isAvailable: true,
      },
    ],
  });
  it("keeps bundle markdown display-only and blocks coupons", async () => {
    const q = await quote(pricingHarness(), [bundle]);
    expect(q.bundleMarkdownPaise).toBe(5_000);
    expect(q.discountMode).toBe("automatic_deals");
    expect(q.grandTotalPaise).toBe(14_000);
    reconcile(q);
    await expect(
      quote(pricingHarness(), [bundle], "SAVE"),
    ).rejects.toMatchObject({
      code: "COUPON_NOT_COMBINABLE_WITH_OFFERS",
      data: {
        couponEligibility: {
          reasonCode: "DEAL_BUNDLE_PRESENT",
          conflictingLineIds: [1],
        },
      },
    });
  });
  it("skips opted-out offers and reports explicit coupon disablement", async () => {
    expect(
      (await quote(pricingHarness([promotion()], { storeEnabled: false })))
        .promotions,
    ).toEqual([]);
    await expect(
      quote(
        pricingHarness([promotion({ kind: "coupon", code: "SAVE" })], {
          storeEnabled: false,
        }),
        [pricingItem()],
        "SAVE",
      ),
    ).rejects.toMatchObject({ code: "PROMOTION_DISABLED_FOR_STORE" });
  });
  it.each([
    [
      { maxRedemptions: 1 },
      { globalRedemptionsUsed: 1 },
      "PROMOTION_CAPACITY_EXHAUSTED",
    ],
    [
      { totalDiscountBudgetPaise: 1_000 },
      { budgetUsedPaise: 1 },
      "PROMOTION_BUDGET_EXHAUSTED",
    ],
    [
      { perUserRedemptionLimit: 1 },
      { userRedemptionsUsed: 1 },
      "PROMOTION_INELIGIBLE",
    ],
    [{ isActive: false }, {}, "PROMOTION_NOT_ACTIVE"],
    [{ endsAt: now }, {}, "PROMOTION_INELIGIBLE"],
  ] as const)(
    "keeps coupon eligibility errors stable",
    async (definition, usage, code) => {
      await expect(
        quote(
          pricingHarness(
            [promotion({ kind: "coupon", code: "SAVE", ...definition })],
            usage,
          ),
          [pricingItem()],
          "SAVE",
        ),
      ).rejects.toMatchObject({ code });
    },
  );
  it("uses qualifying orders and authenticated identity for first-order eligibility", async () => {
    const definition = promotion({ firstOrderOnly: true });
    expect(
      (await quote(pricingHarness([definition], {}, 1))).promotions,
    ).toEqual([]);
    expect(
      (await quote(pricingHarness([definition], {}, 0))).promotions,
    ).toHaveLength(1);
    expect(
      (
        await pricingHarness([definition]).service.buildQuote({
          storeId: 1,
          items: [pricingItem()],
          now,
        })
      ).quote.promotions,
    ).toEqual([]);
  });
  it("uses store timezone at overnight windows", async () => {
    const h = pricingHarness([
      promotion({
        activeStartTime: "22:00",
        activeEndTime: "02:00",
        activeDaysOfWeek: [2],
      }),
    ]);
    const q = (
      await h.service.buildQuote({
        storeId: 1,
        items: [pricingItem()],
        now: new Date("2026-09-15T19:30:00Z"),
      })
    ).quote;
    expect(q.promotions).toHaveLength(1);
    expect(q.deliveryPricing.businessDate).toBe("2026-09-16");
  });
  it("does not fabricate a free-delivery saving on a zero standard fee", async () => {
    const h = pricingHarness([
      promotion({ scope: "delivery", discount: { type: "free_delivery" } }),
    ]);
    h.delivery.deliveryFeePaise = 0;
    const q = await quote(h);
    expect(q.promotions).toEqual([]);
    expect(q.deliveryDiscountPaise).toBe(0);
    reconcile(q);
  });
  it("uses the caller executor for final resolution and demands a transaction", async () => {
    const h = pricingHarness();
    // Opaque executor identity only; every DB boundary is stubbed in this unit test.
    const tx = {} as TransactionType;
    await h.service.buildQuote(
      { storeId: 1, items: [pricingItem()], now },
      { executor: tx, lockPromotions: true },
    );
    expect(h.source.load).toHaveBeenCalledWith(1, null, null, now, {
      executor: tx,
      lockPromotions: true,
    });
    expect(h.repository.findTaxRules).toHaveBeenCalledWith(
      1,
      "item",
      "2026-09-15",
      { executor: tx, lock: true },
    );
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER])(
    "rejects invalid quantities/overflow (%s)",
    async (quantity) => {
      await expect(
        quote(pricingHarness(), [pricingItem({ quantity })]),
      ).rejects.toMatchObject({ code: "PRICING_ITEMS_INVALID" });
    },
  );
  it("rejects unknown/oversized normalized coupons and duplicate lines", async () => {
    await expect(
      quote(pricingHarness(), [pricingItem()], "NOPE"),
    ).rejects.toMatchObject({ code: "PROMOTION_NOT_FOUND" });
    await expect(
      quote(pricingHarness(), [pricingItem()], "ß".repeat(64)),
    ).rejects.toMatchObject({ code: "PROMOTION_INVALID_DEFINITION" });
    await expect(
      quote(pricingHarness(), [pricingItem(), pricingItem()]),
    ).rejects.toMatchObject({ code: "PRICING_ITEMS_INVALID" });
  });
  it("reconciles capped allocations at one-paise remainders over varied cart quantities", async () => {
    for (const amount of [1, 2, 99, 500_000])
      for (const quantity of [1, 2, 7]) {
        const q = await quote(
          pricingHarness([
            promotion({
              discount: { type: "fixed_amount", amountPaise: amount },
            }),
          ]),
          [
            pricingItem({
              baseUnitPricePaise: 101,
              quantity,
              customizations: [],
            }),
            pricingItem({
              lineId: 2,
              baseUnitPricePaise: 103,
              quantity,
              customizations: [],
            }),
          ],
        );
        reconcile(q);
        expect(q.itemDiscountPaise).toBeLessThanOrEqual(q.itemsSubtotalPaise);
      }
  });
});
