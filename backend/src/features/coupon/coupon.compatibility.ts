import type { couponsTable } from "../../db/schema";
import { paiseToRupees } from "../../utils/money";
import type { PricingQuote } from "../pricing/legacy-pricing.service";

type CouponRecord = typeof couponsTable.$inferSelect;

export const toLegacyCouponValidationResponse = (
  coupon: CouponRecord,
  quote: PricingQuote
) => ({
  ...toCouponResponse(coupon),
  quoteVersion: quote.quoteVersion,
  currency: quote.currency,
  pricingPolicyVersion: quote.pricingPolicyVersion,
  itemsSubtotalPaise: quote.itemsSubtotalPaise,
  discountPaise: quote.discountPaise,
  discountAmount: paiseToRupees(quote.discountPaise),
  grandTotalPaise: quote.grandTotalPaise,
});

export const toCouponResponse = (coupon: CouponRecord) => ({
  ...coupon,
  discountValue: coupon.discountType === "percentage"
    ? coupon.discountRateBps! / 100
    : paiseToRupees(coupon.discountAmountPaise!),
  minOrderValue: paiseToRupees(coupon.minimumOrderPaise),
});
