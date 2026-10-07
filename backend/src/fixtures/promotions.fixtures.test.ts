import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { definitionFromRows, definitionToValues, rulesToValues, toPromotionRecord } from "../features/promotions/promotion.mapper";
import { resolvePromotionSet, type PromotionRecord, type PromotionResolutionContext } from "../features/promotions";
import { promotionFixtureArtwork } from "./promotion-media.fixtures";
import { promotionFixtures, PROMOTION_FIXTURE_BUNDLE, PROMOTION_FIXTURE_DATE } from "./promotions.fixtures";
import { buildDemoTruncateSql } from "../scripts/demo-reset.policy";
import { APPLICATION_DATA_TABLE_NAMES } from "../features/system-maintenance/system-maintenance.service";

const definitions = promotionFixtures({ pizzaId: 11, pizzaCategoryId: 4 });
const records: PromotionRecord[] = definitions.map((definition, index) => {
  const row = { ...definitionToValues(definition), id: index + 1, definitionVersion: 1,
    createdAt: PROMOTION_FIXTURE_DATE, updatedAt: PROMOTION_FIXTURE_DATE,
    imageUrl: null, mobileImageUrl: null, imageAlt: null,
    // Apply database defaults in this offline boundary; validation still uses the production mapper.
    ...definition.eligibility, includeCustomizationValue: definition.includeCustomizationValue,
    discountRateBps: definition.discount.type === "percentage" ? definition.discount.rateBps : null,
    discountAmountPaise: definition.discount.type === "fixed_amount" ? definition.discount.amountPaise : null,
    maxDiscountPaise: definition.discount.type === "percentage" ? definition.discount.maxDiscountPaise : null,
    perUserRedemptionLimit: definition.limits.perUserRedemptions, maxRedemptions: definition.limits.globalRedemptions,
    totalDiscountBudgetPaise: definition.limits.budgetPaise, displayPriority: definition.display.priority,
    showOnHomepage: definition.display.showOnHomepage, isActive: definition.isActive,
    activeDaysOfWeek: definition.validity.activeDaysOfWeek, activeStartTime: definition.validity.activeStartTime,
    activeEndTime: definition.validity.activeEndTime, startsAt: new Date(definition.validity.startsAt), endsAt: new Date(definition.validity.endsAt),
  };
  const rules = rulesToValues(row.id, definition.rules).map((rule, i) => ({
    productId: null, categoryId: null, quantity: null, tierMinPaise: null, tierDiscountType: null,
    tierDiscountRateBps: null, tierDiscountAmountPaise: null, tierMaxDiscountPaise: null,
    ...rule, id: i + 1, createdAt: PROMOTION_FIXTURE_DATE, updatedAt: PROMOTION_FIXTURE_DATE,
  }));
  expect(definitionFromRows(row, rules)).toEqual(definition);
  return toPromotionRecord(row, rules);
});
const context = (quantity = 1): PromotionResolutionContext => ({
  now: PROMOTION_FIXTURE_DATE, timezone: "Asia/Kolkata", userId: 1, qualifyingOrderCount: 0, deliveryFeePaise: 5_000,
  items: [{ lineId: 41, productId: 11, categoryId: 4, productType: "single", quantity,
    baseUnitPricePaise: 29_900, customizationUnitPricePaise: 0 }],
  usageByPromotionId: Object.fromEntries(records.map((p) => [p.id, { storeEnabled: true, globalRedemptionsUsed: 0,
    userRedemptionsUsed: 0, budgetUsedPaise: 0 }])),
});
const resolve = (promotion: PromotionRecord, ctx = context()) => resolvePromotionSet({
  promotions: [promotion], couponCode: promotion.code, context: ctx,
});

describe("deterministic promotion release fixtures", () => {
  it("covers every offer and supported manual coupon type through validated persistence round trips", () => {
    expect(records.filter((p) => p.kind === "offer").map((p) => p.discount.type).sort())
      .toEqual(["buy_x_get_y", "fixed_amount", "free_delivery", "percentage", "tiered"]);
    expect(records.filter((p) => p.kind === "coupon").map((p) => p.discount.type).sort())
      .toEqual(["fixed_amount", "percentage", "tiered"]);
    expect(promotionFixtures({ pizzaId: 11, pizzaCategoryId: 4 })).toEqual(definitions);
  });
  it.each([
    ["Demo pizza 10 percent", 1, 2_990, 0], ["Demo pizza 20 rupees off", 1, 2_000, 0],
    ["Demo buy two get one pizza", 3, 29_900, 0], ["Demo delivery saving", 1, 0, 5_000],
    ["Demo cart tiers", 4, 5_980, 0], ["Demo manual 10 percent", 1, 2_990, 0],
    ["Demo manual 30 rupees", 1, 3_000, 0], ["Demo first-order tiers", 1, 1_000, 0],
  ])("resolves %s with exact item and delivery savings", (name, quantity, item, delivery) => {
    const promotion = records.find((p) => p.name === name)!;
    expect(resolve(promotion, context(quantity))).toMatchObject({ ok: true, itemDiscountPaise: item,
      deliveryDiscountPaise: delivery, promotionSavingsPaise: item + delivery });
  });
  it("shows default-on versus explicit opt-out without changing another store", () => {
    const promotion = records[0]; const disabled = context();
    disabled.usageByPromotionId = { [promotion.id]: { storeEnabled: false, globalRedemptionsUsed: 0, userRedemptionsUsed: 0, budgetUsedPaise: 0 } };
    expect(resolve(promotion, disabled)).toMatchObject({ ok: true, itemDiscountPaise: 0 });
    expect(resolve(promotion)).toMatchObject({ ok: true, itemDiscountPaise: 2_990 });
  });
  it("requires a manual coupon and rejects offer/bundle combinations and repeat first orders", () => {
    const coupon = records.find((p) => p.code === "DEMOFIRST")!;
    expect(resolvePromotionSet({ promotions: [coupon], couponCode: null, context: context() })).toMatchObject({ ok: true, discountMode: "none" });
    expect(resolvePromotionSet({ promotions: [records[0], coupon], couponCode: coupon.code, context: context() })).toMatchObject({ ok: false, errorCode: "COUPON_NOT_COMBINABLE_WITH_OFFERS" });
    const bundle = context(); bundle.items[0].productType = "bundle";
    expect(resolve(coupon, bundle)).toMatchObject({ ok: false, errorCode: "COUPON_NOT_COMBINABLE_WITH_OFFERS" });
    const repeat = context(); repeat.qualifyingOrderCount = 1;
    expect(resolve(coupon, repeat)).toMatchObject({ ok: false, errorCode: "PROMOTION_INELIGIBLE" });
  });
  it("keeps bundle compare-at savings separate and covers all promotion/reset tables", () => {
    expect(PROMOTION_FIXTURE_BUNDLE.compareAtPricePaise - PROMOTION_FIXTURE_BUNDLE.pricePaise).toBe(3_000);
    expect(PROMOTION_FIXTURE_BUNDLE.components).toHaveLength(2);
    const sql = buildDemoTruncateSql(APPLICATION_DATA_TABLE_NAMES);
    for (const name of ["promotions", "promotion_rules", "store_promotion_settings", "promotion_applications",
      "promotion_discount_allocations", "bundle_components", "order_item_bundle_components"]) expect(sql).toContain(`"${name}"`);
  });
  it.each(["desktop", "mobile"] as const)("generates decodable %s WebP artwork within upload dimensions", async (variant) => {
    const bytes = await promotionFixtureArtwork(variant); const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("webp"); expect(meta.width).toBe(variant === "desktop" ? 1_200 : 600);
    expect(meta.height).toBe(variant === "desktop" ? 400 : 600); expect(bytes.length).toBeLessThan(5_242_880);
  });
});
