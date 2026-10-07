import type { CartRes } from "@/features/cart";
import type { PricingQuote, PricingQuoteItem, QuotePromotion } from "./model/checkout.types";

export const quoteLine = (lineId = 41): PricingQuoteItem => ({
  lineId, productId: 2, productName: "Saved pizza", quantity: 1,
  unitPricePaise: 10_000, baseUnitPricePaise: 10_000, customizationUnitPricePaise: 0,
  lineSubtotalPaise: 10_000, itemDiscountPaise: 1_000, lineTotalPaise: 9_000,
  productType: "single", compareAtUnitPricePaise: null, bundleMarkdownPaise: 0,
  bundleComponents: [], customizations: [], taxRuleId: 1, taxRuleVersion: 1,
  taxRateBps: 500, taxableAmountPaise: 8_571, taxPaise: 429, hsnSacCode: "996331",
});
export const quotePromotion = (id = 7): QuotePromotion => ({
  id, kind: "offer", name: `Saved offer ${id}`, code: null, definitionVersion: 1,
  discountType: "fixed_amount", applied: true, itemDiscountPaise: 1_000,
  deliveryDiscountPaise: 0, totalSavingsPaise: 1_000,
  allocations: [{ lineId: 41, component: "item", unitIndexes: [0], amountPaise: 1_000 }],
});
export const quoteFixture = (): PricingQuote => ({
  quoteVersion: "v4", pricingPolicyVersion: 4, currency: "INR", discountMode: "automatic_deals",
  itemsSubtotalPaise: 10_000, itemDiscountPaise: 1_000, standardDeliveryFeePaise: 5_000,
  chargedDeliveryFeePaise: 5_000, deliveryDiscountPaise: 0, promotionSavingsPaise: 1_000,
  bundleMarkdownPaise: 0, totalDisplayedSavingsPaise: 1_000, roundingAdjustmentPaise: 0,
  grandTotalPaise: 14_000, taxableAmountPaise: 13_571, taxPaise: 429,
  items: [quoteLine()], promotions: [quotePromotion()],
  couponEligibility: { eligible: false, reasonCode: "OFFER_APPLIED", conflictingLineIds: [41] },
  deliveryPricing: { ruleId: 1, ruleVersion: 1, storeId: 10, businessDate: "2026-10-07", timezone: "Asia/Kolkata", standardFeePaise: 5_000, chargedFeePaise: 5_000 },
  tax: { calculationPolicyVersion: 1, isDemo: true, disclaimer: "Demo tax", placeOfSupplyState: "KA", placeOfSupplySource: "delivery_address", itemRule: { ruleId: 1, ruleVersion: 1, rateBps: 500, hsnSacCode: "996331" }, deliveryRule: { ruleId: 1, ruleVersion: 1, rateBps: 0, hsnSacCode: "996331", taxableAmountPaise: 5_000, taxPaise: 0 } },
});
export const couponQuote = (): PricingQuote => ({
  ...quoteFixture(), discountMode: "coupon",
  promotions: [{ ...quotePromotion(), kind: "coupon", code: "SAVE10", name: "Saved coupon" }],
  couponEligibility: { eligible: true, reasonCode: null, conflictingLineIds: [] },
});
export const cartFixture = (): CartRes => ({
  id: 1, createdAt: "2026-10-07", updatedAt: "2026-10-07", userId: 1,
  totalPaise: 10_000, storeId: 10, store: null,
  items: [{ id: 41, cartId: 1, createdAt: "2026-10-07", updatedAt: "2026-10-07", pricePaise: 10_000, productId: 2, quantity: 1, customizations: [], product: { id: 2, name: "Saved pizza", slug: "pizza", description: null, veg: true, hasCustomization: false, isAvailable: true, pricePaise: 10_000, image: "/pizza.webp", categoryId: 3, productType: "single" } }],
});
