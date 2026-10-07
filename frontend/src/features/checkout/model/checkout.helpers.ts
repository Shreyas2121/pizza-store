import axios from "axios";
import type { CartRes } from "@/features/cart";
import { CHECKOUT_QUERY_RETRY_LIMIT, COUPON_REVALIDATION_CODES } from "./checkout.constants";
import type { PricingQuote } from "./checkout.types";

export const checkoutContextKey = (userId: number | undefined, storeId: number | undefined, addressId: number | null, cart: CartRes | undefined) => JSON.stringify([
  userId, storeId, addressId, cart?.id, cart?.storeId, cart?.updatedAt,
  cart?.items.map((item) => [item.id, item.productId, item.quantity, item.pricePaise, item.updatedAt, item.customizations]),
]);

export const checkoutErrorCode = (cause: unknown): string | undefined =>
  axios.isAxiosError<{ code?: string }>(cause) ? cause.response?.data.code : undefined;
export const couponNeedsRemoval = (cause: unknown) => COUPON_REVALIDATION_CODES.has(checkoutErrorCode(cause) ?? "");
export const checkoutErrorMessage = (cause: unknown, fallback: string) => {
  switch (checkoutErrorCode(cause)) {
    case "COUPON_NOT_COMBINABLE_WITH_OFFERS": return "This coupon cannot be combined with automatic offers or a deal combo. Review the updated quote and conflicting items below.";
    case "PROMOTION_DISABLED_FOR_STORE": return "This promotion is unavailable at your selected store. Refresh your quote.";
    case "PROMOTION_CAPACITY_EXHAUSTED":
    case "PROMOTION_BUDGET_EXHAUSTED": return "This promotion has reached its limit. Refresh your quote to see current pricing.";
    case "PROMOTION_NOT_FOUND":
    case "PROMOTION_NOT_ACTIVE":
    case "PROMOTION_INELIGIBLE": return "This coupon is no longer eligible for this order. Review your cart and try another code.";
    default: return axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message ?? fallback : fallback;
  }
};
export const retryCheckoutQuery = (attempts: number, cause: unknown) => {
  if (axios.isAxiosError(cause) && cause.response && cause.response.status < 500) return false;
  return attempts < CHECKOUT_QUERY_RETRY_LIMIT;
};

// Compare identities/quantities only. Prices and eligibility remain server-owned.
export const quoteMatchesCart = (quote: PricingQuote, cart: CartRes) =>
  quote.items.length === cart.items.length && quote.items.every((line) => {
    const item = cart.items.find((item) => item.id === line.lineId);
    return item?.productId === line.productId && item.quantity === line.quantity &&
      JSON.stringify(item.customizations.map((c) => c.optionId).sort((a, b) => a - b)) ===
      JSON.stringify(line.customizations.map((c) => c.customizationOptionId).sort((a, b) => a - b));
  });
