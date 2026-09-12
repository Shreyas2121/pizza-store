import { describe, expect, it } from "vitest";
import {
  calculateDiscount,
  evaluateEligibility,
  findBestOffersByUnit,
  resolvePromotionSet,
} from "./promotion.logic";
import type {
  PromotionCandidate,
  PromotionEvaluationContext,
  PromotionItemInput,
  PromotionRecord,
  PromotionResolutionContext,
} from "./promotion.types";

const items: PromotionItemInput[] = [
  {
    lineId: 1,
    productId: 11,
    categoryId: 5,
    productType: "single",
    quantity: 1,
    baseUnitPricePaise: 10_000,
    customizationUnitPricePaise: 2_000,
  },
  {
    lineId: 2,
    productId: 20,
    categoryId: 8,
    productType: "single",
    quantity: 1,
    baseUnitPricePaise: 5_000,
    customizationUnitPricePaise: 0,
  },
];

const promotion = (
  overrides: Partial<PromotionRecord> = {}
): PromotionRecord => ({
  id: 1,
  definitionVersion: 1,
  kind: "offer",
  name: "Test offer",
  code: null,
  discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: null },
  scope: "cart",
  includeCustomizationValue: false,
  minimumOrderPaise: 0,
  minimumCartQuantity: 0,
  firstOrderOnly: false,
  startsAt: new Date("2026-01-01T00:00:00.000Z"),
  endsAt: new Date("2027-01-01T00:00:00.000Z"),
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

const evaluationContext = (
  overrides: Partial<PromotionEvaluationContext> = {}
): PromotionEvaluationContext => ({
  now: new Date("2026-09-15T12:00:00.000Z"),
  timezone: "Asia/Kolkata",
  storeEnabled: true,
  userId: 7,
  qualifyingOrderCount: 0,
  globalRedemptionsUsed: 0,
  userRedemptionsUsed: 0,
  budgetUsedPaise: 0,
  deliveryFeePaise: 4_000,
  items,
  ...overrides,
});

const resolutionContext = (
  promotions: PromotionRecord[],
  overrides: Partial<PromotionResolutionContext> = {}
): PromotionResolutionContext => ({
  now: new Date("2026-09-15T12:00:00.000Z"),
  timezone: "Asia/Kolkata",
  userId: 7,
  qualifyingOrderCount: 0,
  deliveryFeePaise: 4_000,
  items,
  usageByPromotionId: Object.fromEntries(
    promotions.map((item) => [
      item.id,
      {
        storeEnabled: true,
        globalRedemptionsUsed: 0,
        userRedemptionsUsed: 0,
        budgetUsedPaise: 0,
      },
    ])
  ),
  ...overrides,
});

describe("promotion eligibility", () => {
  it("uses an inclusive start and exclusive end instant", () => {
    const definition = promotion({
      startsAt: new Date("2026-09-15T12:00:00.000Z"),
      endsAt: new Date("2026-09-15T13:00:00.000Z"),
    });
    expect(
      evaluateEligibility(
        definition,
        evaluationContext({ now: definition.startsAt })
      )
    ).toEqual({ eligible: true });
    expect(
      evaluateEligibility(
        definition,
        evaluationContext({ now: definition.endsAt })
      )
    ).toMatchObject({ eligible: false, reasonCode: "DATE_RESTRICTED" });
  });

  it("assigns an overnight continuation to the weekday on which it starts", () => {
    const definition = promotion({
      activeDaysOfWeek: [2],
      activeStartTime: "22:00",
      activeEndTime: "02:00",
    });
    expect(
      evaluateEligibility(
        definition,
        evaluationContext({
          timezone: "America/New_York",
          now: new Date("2026-09-16T05:59:00.000Z"),
        })
      )
    ).toEqual({ eligible: true });
    expect(
      evaluateEligibility(
        definition,
        evaluationContext({
          timezone: "America/New_York",
          now: new Date("2026-09-16T06:00:00.000Z"),
        })
      )
    ).toMatchObject({ eligible: false, reasonCode: "TIME_RESTRICTED" });
  });

  it("remains deterministic through a DST fall-back overlap", () => {
    const definition = promotion({
      activeDaysOfWeek: [6],
      activeStartTime: "22:00",
      activeEndTime: "02:00",
    });
    for (const now of [
      new Date("2026-11-01T05:30:00.000Z"),
      new Date("2026-11-01T06:30:00.000Z"),
    ]) {
      expect(
        evaluateEligibility(
          definition,
          evaluationContext({ timezone: "America/New_York", now })
        )
      ).toEqual({ eligible: true });
    }
  });

  it.each([
    {
      label: "store opt-out",
      definition: promotion(),
      context: evaluationContext({ storeEnabled: false }),
      errorCode: "PROMOTION_DISABLED_FOR_STORE",
    },
    {
      label: "anonymous first order",
      definition: promotion({ firstOrderOnly: true }),
      context: evaluationContext({ userId: null }),
      reasonCode: "AUTHENTICATION_REQUIRED",
    },
    {
      label: "not first order",
      definition: promotion({ firstOrderOnly: true }),
      context: evaluationContext({ qualifyingOrderCount: 1 }),
      reasonCode: "FIRST_ORDER_REQUIRED",
    },
    {
      label: "per-user limit",
      definition: promotion({ perUserRedemptionLimit: 2 }),
      context: evaluationContext({ userRedemptionsUsed: 2 }),
      reasonCode: "PER_USER_LIMIT_REACHED",
    },
    {
      label: "global capacity",
      definition: promotion({ maxRedemptions: 10 }),
      context: evaluationContext({ globalRedemptionsUsed: 10 }),
      errorCode: "PROMOTION_CAPACITY_EXHAUSTED",
    },
    {
      label: "global budget",
      definition: promotion({ totalDiscountBudgetPaise: 10_000 }),
      context: evaluationContext({ budgetUsedPaise: 10_000 }),
      errorCode: "PROMOTION_BUDGET_EXHAUSTED",
    },
    {
      label: "minimum order",
      definition: promotion({ minimumOrderPaise: 17_001 }),
      context: evaluationContext(),
      reasonCode: "MINIMUM_ORDER_NOT_MET",
    },
    {
      label: "minimum quantity",
      definition: promotion({ minimumCartQuantity: 3 }),
      context: evaluationContext(),
      reasonCode: "MINIMUM_QUANTITY_NOT_MET",
    },
  ])("rejects $label", ({ definition, context, errorCode, reasonCode }) => {
    expect(evaluateEligibility(definition, context)).toMatchObject({
      eligible: false,
      ...(errorCode ? { errorCode } : {}),
      ...(reasonCode ? { reasonCode } : {}),
    });
  });

  it("uses complete pre-promotion subtotal but authoritative target IDs", () => {
    const definition = promotion({
      scope: "product",
      minimumOrderPaise: 17_000,
      rules: [{ type: "product_include", productId: 999 }],
    });
    expect(evaluateEligibility(definition, evaluationContext())).toMatchObject({
      eligible: false,
      reasonCode: "PRODUCT_TARGET_NOT_PRESENT",
    });
  });
});

describe("promotion calculations", () => {
  it("rounds one-paise percentage results and honors caps", () => {
    const onePaiseItem: PromotionItemInput[] = [
      {
        lineId: 1,
        productId: 1,
        categoryId: 1,
        productType: "single",
        quantity: 1,
        baseUnitPricePaise: 1,
        customizationUnitPricePaise: 0,
      },
    ];
    const result = calculateDiscount(
      promotion({
        discount: {
          type: "percentage",
          rateBps: 5_000,
          maxDiscountPaise: 1,
        },
      }),
      onePaiseItem
    );
    expect(result?.allocations).toEqual([
      {
        component: "item",
        lineId: 1,
        unitIndex: 0,
        amountPaise: 1,
      },
    ]);
    const capped = calculateDiscount(
      promotion({
        discount: {
          type: "percentage",
          rateBps: 10_000,
          maxDiscountPaise: 20,
        },
      }),
      [{ ...onePaiseItem[0], baseUnitPricePaise: 100 }]
    );
    expect(capped?.allocations[0].amountPaise).toBe(20);
  });

  it("excludes or includes customization value exactly as configured", () => {
    const pricedItem: PromotionItemInput[] = [
      {
        lineId: 1,
        productId: 1,
        categoryId: 1,
        productType: "single",
        quantity: 1,
        baseUnitPricePaise: 10_000,
        customizationUnitPricePaise: 5_000,
      },
    ];
    const excluded = calculateDiscount(
      promotion({
        discount: { type: "percentage", rateBps: 5_000, maxDiscountPaise: null },
      }),
      pricedItem
    );
    const included = calculateDiscount(
      promotion({
        includeCustomizationValue: true,
        discount: { type: "percentage", rateBps: 5_000, maxDiscountPaise: null },
      }),
      pricedItem
    );
    expect(excluded?.allocations[0].amountPaise).toBe(5_000);
    expect(included?.allocations[0].amountPaise).toBe(7_500);
  });

  it("applies a fixed amount once and allocates exact remainder by stable unit", () => {
    const result = calculateDiscount(
      promotion({ discount: { type: "fixed_amount", amountPaise: 1 } }),
      [
        { ...items[0], baseUnitPricePaise: 100, customizationUnitPricePaise: 0 },
        { ...items[1], baseUnitPricePaise: 100 },
      ]
    );
    expect(result?.allocations).toEqual([
      {
        component: "item",
        lineId: 1,
        unitIndex: 0,
        amountPaise: 1,
      },
    ]);
  });

  it("discounts only authoritative product/category targets", () => {
    const result = calculateDiscount(
      promotion({
        scope: "product",
        discount: {
          type: "percentage",
          rateBps: 10_000,
          maxDiscountPaise: null,
        },
        rules: [{ type: "product_include", productId: 20 }],
      }),
      items
    );
    expect(result?.allocations).toEqual([
      { component: "item", lineId: 2, unitIndex: 0, amountPaise: 5_000 },
    ]);
  });

  it("selects the highest qualifying tier at its exact boundary", () => {
    const result = calculateDiscount(
      promotion({
        discount: { type: "tiered" },
        includeCustomizationValue: true,
        rules: [
          {
            type: "tier",
            minimumSubtotalPaise: 10_000,
            discount: { type: "percentage", rateBps: 1_000, maxDiscountPaise: null },
          },
          {
            type: "tier",
            minimumSubtotalPaise: 17_000,
            discount: { type: "fixed_amount", amountPaise: 3_000 },
          },
        ],
      }),
      items
    );
    expect(
      result?.allocations.reduce((sum, allocation) => sum + allocation.amountPaise, 0)
    ).toBe(3_000);
  });

  it("represents free delivery separately and omits zero-fee applications", () => {
    const definition = promotion({
      scope: "delivery",
      discount: { type: "free_delivery" },
    });
    expect(calculateDiscount(definition, items, 4_000)?.allocations).toEqual([
      {
        component: "delivery",
        lineId: null,
        unitIndex: null,
        amountPaise: 4_000,
      },
    ]);
    expect(calculateDiscount(definition, items, 0)).toBeNull();
  });

  it("forms repeated BXGY groups and discounts the cheapest feasible units", () => {
    const pizzaUnits: PromotionItemInput[] = [
      { ...items[0], quantity: 2, baseUnitPricePaise: 30_000, customizationUnitPricePaise: 0 },
      { ...items[1], productId: 12, categoryId: 5, quantity: 2, baseUnitPricePaise: 10_000 },
      { ...items[1], lineId: 3, productId: 13, categoryId: 5, quantity: 2, baseUnitPricePaise: 20_000 },
    ];
    const result = calculateDiscount(
      promotion({
        scope: "category",
        discount: { type: "buy_x_get_y" },
        rules: [
          {
            type: "buy_x_get_y",
            buyQuantity: 2,
            getQuantity: 1,
            buyProductIds: [],
            buyCategoryIds: [5],
            getProductIds: [],
            getCategoryIds: [5],
          },
        ],
      }),
      pizzaUnits
    );
    expect(result?.allocations).toEqual([
      { component: "item", lineId: 2, unitIndex: 0, amountPaise: 10_000 },
      { component: "item", lineId: 2, unitIndex: 1, amountPaise: 10_000 },
    ]);
  });

  it("requires distinct buy and get units when target pools overlap", () => {
    const result = calculateDiscount(
      promotion({
        scope: "product",
        discount: { type: "buy_x_get_y" },
        rules: [
          {
            type: "buy_x_get_y",
            buyQuantity: 2,
            getQuantity: 1,
            buyProductIds: [11],
            buyCategoryIds: [],
            getProductIds: [11],
            getCategoryIds: [],
          },
        ],
      }),
      [{ ...items[0], quantity: 2 }]
    );
    expect(result).toBeNull();
  });

  it("rejects unsafe or out-of-domain authoritative money inputs", () => {
    expect(() =>
      calculateDiscount(promotion(), [
        { ...items[0], baseUnitPricePaise: Number.MAX_SAFE_INTEGER },
      ])
    ).toThrow();
  });
});

describe("best offer resolution", () => {
  const candidate = (
    definition: PromotionRecord,
    allocations: PromotionCandidate["allocations"]
  ): PromotionCandidate => ({ promotion: definition, allocations });

  it("selects per-unit savings, then priority, then lower promotion ID", () => {
    const lowPriority = promotion({ id: 10, displayPriority: 1 });
    const highPriority = promotion({ id: 20, displayPriority: 2 });
    const lowerId = promotion({ id: 5, displayPriority: 2 });
    const allocation = {
      component: "item" as const,
      lineId: 1,
      unitIndex: 0,
      amountPaise: 100,
    };
    expect(
      findBestOffersByUnit([
        candidate(lowPriority, [{ ...allocation, amountPaise: 101 }]),
        candidate(highPriority, [allocation]),
      ])[0].id
    ).toBe(10);
    expect(
      findBestOffersByUnit([
        candidate(lowPriority, [allocation]),
        candidate(highPriority, [allocation]),
        candidate(lowerId, [allocation]),
      ])[0].id
    ).toBe(5);
  });

  it("keeps distinct-line offers and never redistributes losing allocations", () => {
    const cartOffer = promotion({ id: 1 });
    const lineOffer = promotion({ id: 2 });
    const result = findBestOffersByUnit([
      candidate(cartOffer, [
        { component: "item", lineId: 1, unitIndex: 0, amountPaise: 50 },
        { component: "item", lineId: 2, unitIndex: 0, amountPaise: 50 },
      ]),
      candidate(lineOffer, [
        { component: "item", lineId: 1, unitIndex: 0, amountPaise: 60 },
      ]),
    ]);
    expect(result).toMatchObject([
      { id: 1, totalSavingsPaise: 50 },
      { id: 2, totalSavingsPaise: 60 },
    ]);
  });

  it("is independent of candidate input order", () => {
    const first = candidate(promotion({ id: 2, displayPriority: 5 }), [
      { component: "item", lineId: 1, unitIndex: 0, amountPaise: 100 },
    ]);
    const second = candidate(promotion({ id: 1, displayPriority: 5 }), [
      { component: "item", lineId: 1, unitIndex: 0, amountPaise: 100 },
    ]);
    expect(findBestOffersByUnit([first, second])).toEqual(
      findBestOffersByUnit([second, first])
    );
  });

  it("rejects malformed externally supplied candidate allocations", () => {
    expect(() =>
      findBestOffersByUnit([
        candidate(promotion(), [
          { component: "item", lineId: 1, unitIndex: 0, amountPaise: 0 },
        ]),
      ])
    ).toThrow("must be positive");
  });
});

describe("exclusive promotion set resolution", () => {
  it("resolves offers automatically and rejects a coupon with sorted conflicts", () => {
    const offer = promotion({
      id: 1,
      scope: "product",
      rules: [{ type: "product_include", productId: 11 }],
    });
    const coupon = promotion({
      id: 2,
      kind: "coupon",
      code: "SAVE10",
      name: "Save 10",
    });
    const cartItems: PromotionItemInput[] = [
      items[0],
      { ...items[1], productType: "bundle" },
    ];
    const context = resolutionContext([offer, coupon], { items: cartItems });

    expect(resolvePromotionSet({ promotions: [coupon, offer], context })).toMatchObject({
      ok: true,
      discountMode: "automatic_deals",
      couponEligibility: {
        eligible: false,
        reasonCode: "OFFER_APPLIED",
        conflictingLineIds: [1, 2],
      },
    });
    expect(
      resolvePromotionSet({
        promotions: [offer, coupon],
        couponCode: "save10",
        context,
      })
    ).toMatchObject({
      ok: false,
      errorCode: "COUPON_NOT_COMBINABLE_WITH_OFFERS",
    });
  });

  it("uses deal-bundle mode even without a promotion application", () => {
    const context = resolutionContext([], {
      items: [{ ...items[0], productType: "bundle" }],
    });
    expect(resolvePromotionSet({ promotions: [], context })).toMatchObject({
      ok: true,
      discountMode: "automatic_deals",
      promotions: [],
      couponEligibility: {
        reasonCode: "DEAL_BUNDLE_PRESENT",
        conflictingLineIds: [1],
      },
    });
  });

  it("applies only the manually supplied normalized coupon", () => {
    const coupon = promotion({
      id: 7,
      kind: "coupon",
      code: "SAVE10",
      name: "Save 10",
    });
    const context = resolutionContext([coupon]);
    expect(
      resolvePromotionSet({
        promotions: [coupon],
        couponCode: " save10 ",
        context,
      })
    ).toMatchObject({
      ok: true,
      discountMode: "coupon",
      promotions: [{ id: 7, totalSavingsPaise: 1_500 }],
      itemDiscountPaise: 1_500,
      deliveryDiscountPaise: 0,
    });
    expect(
      resolvePromotionSet({
        promotions: [coupon],
        couponCode: "unknown",
        context,
      })
    ).toMatchObject({ ok: false, errorCode: "PROMOTION_NOT_FOUND" });
  });

  it("rejects an exact coupon application beyond remaining budget", () => {
    const coupon = promotion({
      id: 7,
      kind: "coupon",
      code: "SAVE10",
      totalDiscountBudgetPaise: 2_000,
    });
    const context = resolutionContext([coupon], {
      usageByPromotionId: {
        7: {
          storeEnabled: true,
          globalRedemptionsUsed: 0,
          userRedemptionsUsed: 0,
          budgetUsedPaise: 501,
        },
      },
    });
    expect(
      resolvePromotionSet({ promotions: [coupon], couponCode: "SAVE10", context })
    ).toMatchObject({ ok: false, errorCode: "PROMOTION_BUDGET_EXHAUSTED" });
  });

  it("silently excludes an automatic offer whose exact candidate exceeds budget", () => {
    const offer = promotion({ id: 9, totalDiscountBudgetPaise: 1_000 });
    const context = resolutionContext([offer]);
    expect(resolvePromotionSet({ promotions: [offer], context })).toMatchObject({
      ok: true,
      discountMode: "none",
      promotions: [],
    });
  });

  it("blocks a coupon for a delivery offer without inventing a line conflict", () => {
    const offer = promotion({
      id: 9,
      scope: "delivery",
      discount: { type: "free_delivery" },
    });
    const coupon = promotion({ id: 10, kind: "coupon", code: "SAVE10" });
    const context = resolutionContext([offer, coupon]);
    expect(
      resolvePromotionSet({
        promotions: [offer, coupon],
        couponCode: "SAVE10",
        context,
      })
    ).toMatchObject({
      ok: false,
      errorCode: "COUPON_NOT_COMBINABLE_WITH_OFFERS",
      couponEligibility: {
        reasonCode: "OFFER_APPLIED",
        conflictingLineIds: [],
      },
    });
  });

  it("never produces negative savings or allocations beyond the item basis", () => {
    for (let amount = 1; amount <= 100; amount += 1) {
      const definition = promotion({
        discount: {
          type: "percentage",
          rateBps: ((amount * 97) % 10_000) + 1,
          maxDiscountPaise: null,
        },
      });
      const pricedItems: PromotionItemInput[] = [
        {
          ...items[0],
          baseUnitPricePaise: amount,
          customizationUnitPricePaise: 0,
          quantity: 3,
        },
      ];
      const result = calculateDiscount(definition, pricedItems);
      const savings =
        result?.allocations.reduce(
          (sum, allocation) => sum + allocation.amountPaise,
          0
        ) ?? 0;
      expect(savings).toBeGreaterThanOrEqual(0);
      expect(savings).toBeLessThanOrEqual(amount * 3);
      expect(
        result?.allocations.every((allocation) => allocation.amountPaise > 0) ??
          true
      ).toBe(true);
    }
  });
});
