import { describe, expect, it } from "vitest";
import { PROMOTION_CODE_MAX_LENGTH } from "./promotion.constants";
import {
  promotionDefinitionWriteSchema,
  promotionListQuerySchema,
  storePromotionSettingWriteSchema,
} from "./promotion.schemas";

const validDefinition = () => ({
  kind: "offer" as const,
  name: "Farmhouse Friday",
  description: "20% off eligible pizzas.",
  code: null,
  discount: {
    type: "percentage" as const,
    rateBps: 2_000,
    maxDiscountPaise: 15_000,
  },
  scope: "product" as const,
  includeCustomizationValue: false,
  eligibility: {
    minimumOrderPaise: 30_000,
    minimumCartQuantity: 1,
    firstOrderOnly: false,
  },
  validity: {
    startsAt: "2026-09-18T00:00:00.000Z",
    endsAt: "2026-10-01T00:00:00.000Z",
    activeDaysOfWeek: [5] as const,
    activeStartTime: "22:00",
    activeEndTime: "02:00",
  },
  limits: {
    perUserRedemptions: 2,
    globalRedemptions: null,
    budgetPaise: 500_000,
  },
  display: { priority: 50, showOnHomepage: false },
  rules: [{ type: "product_include" as const, productId: 11 }],
  isActive: true,
});

describe("promotion definition schemas", () => {
  it("enforces the code length after uppercase normalization expands Unicode", () => {
    const coupon = { ...validDefinition(), kind: "coupon", code: "ß".repeat(PROMOTION_CODE_MAX_LENGTH), scope: "cart", rules: [] };
    expect(promotionDefinitionWriteSchema.safeParse(coupon).success).toBe(false);
  });
  it("accepts the frozen contract and permits overnight time windows", () => {
    const result = promotionDefinitionWriteSchema.parse(validDefinition());

    expect(result.validity).toMatchObject({
      activeStartTime: "22:00",
      activeEndTime: "02:00",
    });
  });

  it("normalizes coupon codes and rejects unknown fields", () => {
    const coupon = {
      ...validDefinition(),
      kind: "coupon" as const,
      code: " welcome10 ",
      scope: "cart" as const,
      rules: [],
    };
    expect(promotionDefinitionWriteSchema.parse(coupon).code).toBe("WELCOME10");
    expect(() =>
      promotionDefinitionWriteSchema.parse({ ...coupon, offerId: 99 })
    ).toThrow();
  });

  it.each([
    { label: "coupon without code", change: { kind: "coupon", code: null } },
    { label: "offer with code", change: { code: "OFFER" } },
    {
      label: "coupon product scope",
      change: { kind: "coupon", code: "SAVE", scope: "product" },
    },
    {
      label: "free delivery product scope",
      change: { discount: { type: "free_delivery" }, scope: "product" },
    },
    {
      label: "BXGY customization value",
      change: {
        discount: { type: "buy_x_get_y" },
        includeCustomizationValue: true,
      },
    },
  ])("rejects invalid kind/type/scope shape: $label", ({ change }) => {
    expect(() =>
      promotionDefinitionWriteSchema.parse({ ...validDefinition(), ...change })
    ).toThrow();
  });

  it.each([
    { activeStartTime: "22:00", activeEndTime: null },
    { activeStartTime: "22:00", activeEndTime: "22:00" },
    { activeStartTime: "24:00", activeEndTime: "02:00" },
  ])("rejects an invalid time pair %#", (times) => {
    const definition = validDefinition();
    expect(() =>
      promotionDefinitionWriteSchema.parse({
        ...definition,
        validity: { ...definition.validity, ...times },
      })
    ).toThrow();
  });

  it("rejects reversed half-open validity and duplicate weekdays", () => {
    const definition = validDefinition();
    expect(() =>
      promotionDefinitionWriteSchema.parse({
        ...definition,
        validity: {
          ...definition.validity,
          startsAt: definition.validity.endsAt,
          endsAt: definition.validity.startsAt,
          activeDaysOfWeek: [5, 5],
        },
      })
    ).toThrow();
  });

  it("requires complete, unique BXGY targets", () => {
    const definition = validDefinition();
    const bxgy = {
      ...definition,
      discount: { type: "buy_x_get_y" as const },
      rules: [
        {
          type: "buy_x_get_y" as const,
          buyQuantity: 2,
          getQuantity: 1,
          buyProductIds: [11, 11],
          buyCategoryIds: [],
          getProductIds: [],
          getCategoryIds: [],
        },
      ],
    };
    expect(() => promotionDefinitionWriteSchema.parse(bxgy)).toThrow();
  });

  it("requires unique tier thresholds and tier-only rules", () => {
    const definition = validDefinition();
    const tier = {
      ...definition,
      scope: "cart" as const,
      discount: { type: "tiered" as const },
      rules: [
        {
          type: "tier" as const,
          minimumSubtotalPaise: 50_000,
          discount: {
            type: "percentage" as const,
            rateBps: 1_000,
            maxDiscountPaise: null,
          },
        },
        {
          type: "tier" as const,
          minimumSubtotalPaise: 50_000,
          discount: { type: "fixed_amount" as const, amountPaise: 5_000 },
        },
      ],
    };
    expect(() => promotionDefinitionWriteSchema.parse(tier)).toThrow();
  });

  it("rejects numeric unlimited sentinels and coupon homepage placement", () => {
    const coupon = {
      ...validDefinition(),
      kind: "coupon" as const,
      code: "SAVE",
      scope: "cart" as const,
      rules: [],
      limits: {
        perUserRedemptions: -1,
        globalRedemptions: null,
        budgetPaise: null,
      },
      display: { priority: 0, showOnHomepage: true },
    };
    expect(() => promotionDefinitionWriteSchema.parse(coupon)).toThrow();
  });
});

describe("promotion governance schemas", () => {
  it("requires a bounded reason only when disabling", () => {
    expect(storePromotionSettingWriteSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
    expect(() =>
      storePromotionSettingWriteSchema.parse({ enabled: false })
    ).toThrow();
    expect(
      storePromotionSettingWriteSchema.parse({
        enabled: false,
        reason: " local campaign conflict ",
      })
    ).toEqual({ enabled: false, reason: "local campaign conflict" });
  });

  it("applies named pagination defaults and bounds", () => {
    expect(promotionListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(() => promotionListQuerySchema.parse({ pageSize: 101 })).toThrow();
  });
});
