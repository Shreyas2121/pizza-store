import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  promotionAnalyticsQuerySchema,
  promotionDefinitionWriteSchema,
  promotionUpdateRequestSchema,
  storePromotionSettingWriteSchema,
} from "./promotion.schemas";
import {
  canManageStorePromotions,
  definitionFromPromotion,
  formatPromotionAggregate,
  newPromotionDefinition,
  utcInputToIso,
  retryPromotionQuery,
} from "./promotion.helpers";
import { imageDimensionsError, imageFileError } from "./promotion-media";
import { PROMOTION_IMAGE_MAX_BYTES } from "./promotion.constants";
import type { Promotion } from "./promotion.types";
import type { UserAccessResponse } from "@/features/access";

export const validDefinition = () => ({
  ...newPromotionDefinition(),
  name: "Weekday offer",
  description: "Eligible pizzas",
  validity: {
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-11-01T00:00:00.000Z",
    activeDaysOfWeek: null,
    activeStartTime: null,
    activeEndTime: null,
  },
});
describe("promotion administration form contract", () => {
  it("keeps nullable limits unlimited and rejects sentinels, fractions and unsafe values", () => {
    const value = validDefinition();
    expect(promotionDefinitionWriteSchema.parse(value).limits).toEqual({
      perUserRedemptions: null,
      globalRedemptions: null,
      budgetPaise: null,
    });
    for (const budgetPaise of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER, Number.NaN])
      expect(
        promotionDefinitionWriteSchema.safeParse({
          ...value,
          limits: { ...value.limits, budgetPaise },
        }).success,
      ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({ ...value, offerId: 1 })
        .success,
    ).toBe(false);
  });
  it("normalizes manual coupon codes and forbids offer codes and invalid coupon types", () => {
    const value = validDefinition();
    expect(
      promotionDefinitionWriteSchema.parse({
        ...value,
        kind: "coupon",
        code: " save10 ",
      }).code,
    ).toBe("SAVE10");
    expect(
      promotionDefinitionWriteSchema.safeParse({ ...value, code: "SAVE10" })
        .success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        kind: "coupon",
        code: null,
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        kind: "coupon",
        code: "SAVE10",
        scope: "delivery",
        discount: { type: "free_delivery" },
      }).success,
    ).toBe(false);
  });
  it("requires matching unique product/category targets", () => {
    const value = { ...validDefinition(), scope: "product" };
    expect(promotionDefinitionWriteSchema.safeParse(value).success).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [{ type: "product_include", productId: 1 }],
      }).success,
    ).toBe(true);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [{ type: "category_include", categoryId: 1 }],
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [
          { type: "product_include", productId: 1 },
          { type: "product_include", productId: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("requires complete BXGY targets and excludes customization from BXGY", () => {
    const rule = {
      type: "buy_x_get_y",
      buyQuantity: 2,
      getQuantity: 1,
      buyProductIds: [1],
      buyCategoryIds: [],
      getProductIds: [2],
      getCategoryIds: [],
    };
    const value = {
      ...validDefinition(),
      scope: "product",
      discount: { type: "buy_x_get_y" },
      rules: [rule],
    };
    expect(promotionDefinitionWriteSchema.safeParse(value).success).toBe(true);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [{ ...rule, getProductIds: [] }],
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        includeCustomizationValue: true,
      }).success,
    ).toBe(false);
  });
  it("rejects empty/duplicate tiers and invalid nested discounts", () => {
    const value = { ...validDefinition(), discount: { type: "tiered" } };
    const tier = {
      type: "tier",
      minimumSubtotalPaise: 0,
      discount: { type: "fixed_amount", amountPaise: 1 },
    };
    expect(
      promotionDefinitionWriteSchema.safeParse({ ...value, rules: [tier] })
        .success,
    ).toBe(true);
    expect(promotionDefinitionWriteSchema.safeParse(value).success).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [tier, tier],
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        rules: [{ ...tier, discount: { type: "free_delivery" } }],
      }).success,
    ).toBe(false);
  });
  it("permits overnight schedules but rejects equal endpoints and partial windows", () => {
    const value = validDefinition();
    const validity = {
      ...value.validity,
      activeDaysOfWeek: [5],
      activeStartTime: "22:00",
      activeEndTime: "02:00",
    };
    expect(
      promotionDefinitionWriteSchema.safeParse({ ...value, validity }).success,
    ).toBe(true);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        validity: { ...validity, activeEndTime: "22:00" },
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        validity: { ...validity, activeEndTime: null },
      }).success,
    ).toBe(false);
    expect(
      promotionDefinitionWriteSchema.safeParse({
        ...value,
        validity: { ...validity, endsAt: validity.startsAt },
      }).success,
    ).toBe(false);
  });
  it("sends only writable fields and requires a version on full updates", () => {
    const promotion: Promotion = {
      ...validDefinition(),
      id: 1,
      definitionVersion: 2,
      status: "inactive",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      display: {
        priority: 0,
        showOnHomepage: false,
        imageUrl: "/uploads/promotions/a.jpg",
        mobileImageUrl: null,
        imageAlt: "Pizza",
      },
    };
    const definition = definitionFromPromotion(promotion);
    expect(promotionDefinitionWriteSchema.safeParse(definition).success).toBe(
      true,
    );
    expect(definition.display).toEqual({ priority: 0, showOnHomepage: false });
    expect(promotionUpdateRequestSchema.safeParse(definition).success).toBe(
      false,
    );
    expect(
      promotionUpdateRequestSchema.parse({
        ...definition,
        expectedDefinitionVersion: 2,
      }).expectedDefinitionVersion,
    ).toBe(2);
  });
  it("requires a disable reason and bounds optional enable reasons", () => {
    expect(
      storePromotionSettingWriteSchema.safeParse({ enabled: false }).success,
    ).toBe(false);
    expect(
      storePromotionSettingWriteSchema.safeParse({
        enabled: false,
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      storePromotionSettingWriteSchema.parse({
        enabled: false,
        reason: " out of stock ",
      }).reason,
    ).toBe("out of stock");
    expect(
      storePromotionSettingWriteSchema.safeParse({ enabled: true }).success,
    ).toBe(true);
    expect(
      storePromotionSettingWriteSchema.safeParse({
        enabled: true,
        reason: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
  it("validates analytics date order", () => {
    expect(
      promotionAnalyticsQuerySchema.safeParse({
        fromBusinessDate: "2026-10-08",
        toBusinessDate: "2026-10-07",
      }).success,
    ).toBe(false);
    expect(
      promotionAnalyticsQuerySchema.safeParse({
        fromBusinessDate: "2026-10-07",
        toBusinessDate: "2026-10-07",
      }).success,
    ).toBe(true);
  });
  it("treats UTC input consistently regardless of the browser timezone, retaining seconds", () => {
    expect(utcInputToIso("2026-10-07T12:00")).toBe("2026-10-07T12:00:00.000Z");
    expect(utcInputToIso("2026-10-07T12:30:15.123")).toBe(
      "2026-10-07T12:30:15.123Z",
    );
    expect(utcInputToIso("")).toBe("");
  });
  it("formats report paise beyond Number's safe range without losing money", () => {
    expect(formatPromotionAggregate("900719925474099199")).toBe(
      "₹9,00,71,99,25,47,40,991.99",
    );
  });
});
describe("store promotion permission boundary", () => {
  const membership = {
    membershipId: 1,
    role: "manager" as const,
    store: { id: 10, name: "Main", slug: "main" },
    permissions: ["store.promotions.toggle"],
  };
  const access: UserAccessResponse = {
    platformRole: "user",
    memberships: [membership],
  };
  it("requires same-store manager permission and excludes platform-admin bypass", () => {
    expect(canManageStorePromotions(access, 10)).toBe(true);
    expect(canManageStorePromotions(access, 20)).toBe(false);
    expect(
      canManageStorePromotions({ ...access, platformRole: "admin" }, 10),
    ).toBe(false);
    expect(
      canManageStorePromotions(
        { ...access, memberships: [{ ...membership, role: "operator" }] },
        10,
      ),
    ).toBe(false);
    expect(
      canManageStorePromotions(
        { ...access, memberships: [{ ...membership, permissions: [] }] },
        10,
      ),
    ).toBe(false);
  });
});
describe("promotion media advisory checks", () => {
  it("bounds bytes/formats and variant dimensions without accepting SVG", () => {
    expect(
      imageFileError({ size: PROMOTION_IMAGE_MAX_BYTES, type: "image/webp" }),
    ).toBeNull();
    expect(
      imageFileError({
        size: PROMOTION_IMAGE_MAX_BYTES + 1,
        type: "image/webp",
      }),
    ).not.toBeNull();
    expect(imageFileError({ size: 1, type: "image/svg+xml" })).not.toBeNull();
    expect(imageDimensionsError(1200, 400, "desktop")).toBeNull();
    expect(imageDimensionsError(600, 600, "mobile")).toBeNull();
    expect(imageDimensionsError(1200, 400, "mobile")).not.toBeNull();
    expect(imageDimensionsError(4097, 600, "desktop")).not.toBeNull();
  });
});

describe("private promotion query retries", () => {
  it("does not retry permission or validation failures", () => {
    const error = new AxiosError("Denied");
    error.response = {
      status: 403,
      statusText: "Forbidden",
      data: { code: "PERMISSION_DENIED" },
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    expect(retryPromotionQuery(0, error)).toBe(false);
  });
  it("bounds retries for transport failures", () => {
    expect(retryPromotionQuery(0, new Error("offline"))).toBe(true);
    expect(retryPromotionQuery(2, new Error("offline"))).toBe(false);
  });
});
