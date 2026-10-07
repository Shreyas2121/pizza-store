import { calculateInclusiveTax } from "../utils/money";
import { PRICING_POLICY_VERSION } from "../features/pricing";
import type { buildDeliveredOrderPayload } from "../features/finance-events/order-recognition.payload";

type RecognitionOrder = Parameters<typeof buildDeliveredOrderPayload>[0];

// Shared global promotion, distinct fulfilling stores. These fixtures need no DB
// and keep merchandising savings separate from customer-paid money.
export const promotionFinanceFixture = (storeId: 1 | 2, mode: "automatic_deals" | "coupon" = "automatic_deals", bundle = false) => {
  const subtotal = 10_500 * storeId;
  const itemDiscount = bundle ? 0 : 1_050 * storeId;
  const paid = subtotal - itemDiscount;
  const tax = calculateInclusiveTax(paid, 500);
  const standardDeliveryFeePaise = 5_250;
  const deliveryDiscountPaise = mode === "automatic_deals" ? standardDeliveryFeePaise : 0;
  const chargedDeliveryFeePaise = standardDeliveryFeePaise - deliveryDiscountPaise;
  const deliveryTax = calculateInclusiveTax(chargedDeliveryFeePaise, 500);
  const order: RecognitionOrder = {
    id: 100 + storeId, pricingPolicyVersion: PRICING_POLICY_VERSION, discountMode: mode,
    itemsSubtotalPaise: subtotal, discountPaise: itemDiscount,
    deliveryFeePaise: chargedDeliveryFeePaise,
    deliveryTaxableAmountPaise: deliveryTax.taxableAmountPaise, deliveryTaxPaise: deliveryTax.taxPaise,
    taxPaise: tax.taxPaise + deliveryTax.taxPaise,
    grandTotalPaise: paid + chargedDeliveryFeePaise, roundingAdjustmentPaise: 0,
  };
  return {
    storeId, order,
    lines: [{
      orderItemId: 200 + storeId, productId: 8, quantity: 1, costVersionId: 3,
      unitCostPaise: 1_800, lineCostPaise: 1_800,
      lineSubtotalPaise: subtotal, discountAllocationPaise: itemDiscount,
      ...tax, taxRateBps: 500,
      productType: bundle ? "bundle" : "single",
      compareAtUnitPricePaise: bundle ? subtotal + 5_250 : null,
      bundleMarkdownPaise: bundle ? 5_250 : 0,
    }],
    applications: [
      ...(itemDiscount ? [{ promotionId: 7, status: "consumed" as const, itemDiscountPaise: itemDiscount, deliveryDiscountPaise: 0, totalSavingsPaise: itemDiscount }] : []),
      ...(deliveryDiscountPaise ? [{ promotionId: 9, status: "consumed" as const, itemDiscountPaise: 0, deliveryDiscountPaise, totalSavingsPaise: deliveryDiscountPaise }] : []),
    ],
  };
};
