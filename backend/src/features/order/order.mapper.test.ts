import { describe, expect, it } from "vitest";
import { orderGrandTotalRupees, toOrderResponse } from "./order.mapper";

const now = new Date("2026-07-01T10:00:00Z");
const base = {
  id: 42, userId: 7, storeId: 1, discountMode: "none" as const,
  discountPaise: 0, grandTotalPaise: 40_000, itemsSubtotalPaise: 40_000,
  deliveryFeePaise: 0, taxableAmountPaise: 40_000, taxPaise: 0,
  roundingAdjustmentPaise: 0, currency: "INR" as const,
  quoteVersion: "2026-09-12-03", pricingPolicyVersion: 4,
  deliveryPricingRuleId: 1, deliveryPricingRuleVersion: 1,
  pricingBusinessDate: "2026-07-01", pricingTimezone: "Asia/Kolkata",
  taxCalculationPolicyVersion: 1, taxDisclaimer: "Portfolio demo — not a statutory tax invoice",
  taxIsDemo: true, placeOfSupplyState: "Karnataka",
  deliveryTaxRuleId: 2, deliveryTaxRuleVersion: 1, deliveryTaxRateBps: 0,
  deliveryTaxableAmountPaise: 0, deliveryTaxPaise: 0, deliveryHsnSacCode: "DELIVERY",
  recognizedAt: null, cancelledAt: null, deliveredAt: null,
  status: "pending" as const, paymentType: "cash" as const, paymentId: 1, addressId: 2,
  orderDate: now, createdAt: now, updatedAt: now,
  items: [], promotionApplications: [],
};
const line = {
  id: 5, orderId: 42, productId: 3, quantity: 1,
  productName: "Pizza", productType: "single" as const, unitPricePaise: 25_000,
  compareAtUnitPricePaise: null, bundleMarkdownPaise: 0,
  lineSubtotalPaise: 25_000, discountAllocationPaise: 0,
  taxRuleId: 1, taxRuleVersion: 1, taxRateBps: 0,
  taxableAmountPaise: 25_000, taxPaise: 0, lineTotalPaise: 25_000,
  unitCostPaise: null, lineCostPaise: null, costVersionId: null, hsnSacCode: "FOOD",
  createdAt: now, updatedAt: now, orderItemCustomizations: [], bundleComponents: [],
};
const application = {
  id: 9, orderId: 42, userId: 7, storeId: 1, promotionId: 6,
  promotionKind: "offer" as const, promotionName: "Saved offer", promotionCode: null,
  discountType: "fixed_amount" as const, definitionVersion: 2, status: "released" as const,
  itemDiscountPaise: 1_000, deliveryDiscountPaise: 0, totalSavingsPaise: 1_000,
  standardDeliveryFeePaise: 5_000, chargedDeliveryFeePaise: 0,
  reservedAt: now, consumedAt: null, releasedAt: now, createdAt: now, updatedAt: now,
  allocations: [{ id: 1, promotionApplicationId: 9, orderItemId: 5, component: "item" as const, unitIndex: 0, amountPaise: 1_000, createdAt: now }],
  promotion: { name: "Renamed offer", isActive: false, secretCode: "HIDDEN" },
};

describe("order exact snapshot mapper", () => {
  it("reads saved selling prices, names and customizations without mutable name joins", () => {
    const input = {
      ...base, discountPaise: 10_000, totalPrice: 999, discountAmount: 999,
      items: [{
        ...line, productName: "Snapshot Pizza", productId: 3, unitPricePaise: 25_000,
        product: { name: "Renamed Pizza", price: 999, image: "/current.jpg" },
        unitCostPaise: 8_000, lineCostPaise: 16_000,
        orderItemCustomizations: [{ customizationOptionId: 2, customizationName: "Saved Cheese", pricePaise: 5_000, customizationOption: { name: "Renamed Cheese" } }],
      }],
    };
    const response = toOrderResponse(input);
    expect(response).toMatchObject({ discountAmount: 100, totalPrice: 400, items: [{
      price: 200, product: { name: "Snapshot Pizza" }, options: [{ name: "Saved Cheese", price: 50 }],
    }] });
    expect(response.items[0]).not.toHaveProperty("unitCostPaise");
    expect(response.items[0]).not.toHaveProperty("lineCostPaise");
    expect(response.items[0]).not.toHaveProperty("orderItemCustomizations");
  });

  it("preserves released application history, amounts, versions and allocation targets after definition edits", () => {
    const input = { ...base, discountMode: "automatic_deals" as const, discountPaise: 1_000, promotionApplications: [application] };
    const before = toOrderResponse(input);
    application.promotion.name = "Changed again";
    const after = toOrderResponse(input);
    expect(after).toEqual(before);
    expect(after.promotions[0]).toMatchObject({ id: 6, name: "Saved offer", definitionVersion: 2, status: "released", itemDiscountPaise: 1_000,
      allocations: [{ orderItemId: 5, component: "item", unitIndex: 0, amountPaise: 1_000 }] });
    expect(after.promotions[0]).not.toHaveProperty("promotion");
    expect(after).not.toHaveProperty("promotionApplications");
  });

  it("keeps delivery savings and compare-at markdown separate from item discounts and paid totals", () => {
    const response = toOrderResponse({
      ...base, discountMode: "automatic_deals", discountPaise: 1_000,
      promotionApplications: [application, { ...application, id: 10, promotionId: 7, discountType: "free_delivery", itemDiscountPaise: 0, deliveryDiscountPaise: 5_000, totalSavingsPaise: 5_000,
        allocations: [{ ...application.allocations[0], id: 2, promotionApplicationId: 10, component: "delivery", orderItemId: null, unitIndex: null, amountPaise: 5_000 }] }],
      items: [{ ...line, productName: "Saved combo", productId: 4, productType: "bundle", unitPricePaise: 25_000, compareAtUnitPricePaise: 30_000, bundleMarkdownPaise: 5_000,
        bundleComponents: [{ id: 1, orderItemId: 5, componentProductId: 3, componentName: "Saved pizza", quantityPerBundle: 1, totalQuantity: 2, createdAt: now, updatedAt: now }] }],
    });
    expect(response).toMatchObject({ itemDiscountPaise: 1_000, deliveryDiscountPaise: 5_000, promotionSavingsPaise: 6_000, bundleMarkdownPaise: 5_000, totalDisplayedSavingsPaise: 11_000, grandTotalPaise: 40_000 });
    expect(response.items[0].bundleComponents).toEqual([{ componentProductId: 3, name: "Saved pizza", quantityPerBundle: 1, totalQuantity: 2 }]);
  });

  it("returns empty promotion collections and supports zero totals and the order boundary", () => {
    expect(toOrderResponse({ ...base, discountPaise: 20_000, grandTotalPaise: 0 })).toMatchObject({ discountAmount: 200, totalPrice: 0, promotions: [] });
    expect(orderGrandTotalRupees({ discountPaise: 0, grandTotalPaise: 500_000 })).toBe(5_000);
  });

  it("rejects missing exact snapshots instead of using legacy float values", () => {
    expect(() => toOrderResponse({ ...base, discountPaise: null, grandTotalPaise: null }))
      .toThrowError(expect.objectContaining({ code: "ORDER_MONEY_SNAPSHOT_MISSING" }));
    expect(() => toOrderResponse({ ...base, items: [{ ...line, productName: null, unitPricePaise: 100 }] }))
      .toThrowError(expect.objectContaining({ code: "ORDER_MONEY_SNAPSHOT_MISSING" }));
  });
});
