import type { couponsTable } from "../../db/schema";
import { paiseToRupees } from "../../utils/money";
import type { PricingQuote } from "../pricing/pricing.service";

type CouponRecord = typeof couponsTable.$inferSelect;

export const toLegacyCouponValidationResponse = (
  coupon: CouponRecord,
  quote: PricingQuote
) => ({
  ...coupon,
  quoteVersion: quote.quoteVersion,
  currency: quote.currency,
  pricingPolicyVersion: quote.pricingPolicyVersion,
  itemsSubtotalPaise: quote.itemsSubtotalPaise,
  discountPaise: quote.discountPaise,
  discountAmount: paiseToRupees(quote.discountPaise),
  grandTotalPaise: quote.grandTotalPaise,
});
