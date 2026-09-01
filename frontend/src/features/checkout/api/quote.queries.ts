import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type {
  CheckoutQuoteRequest,
  CheckoutQuoteResponse,
  PricingQuote,
} from "../model/checkout.types";

export const checkoutQuoteKeys = {
  all: ["checkout-quote"] as const,
  quote: (req: CheckoutQuoteRequest | null) =>
    [
      "checkout-quote",
      req?.storeId,
      req?.couponCode,
      req?.destinationState,
      req?.addressId,
      req?.items,
    ] as const,
};

export const useCheckoutQuote = (
  request: CheckoutQuoteRequest | null,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: checkoutQuoteKeys.quote(request),
    queryFn: async (): Promise<PricingQuote | null> => {
      if (!request || !request.storeId) {
        return null;
      }
      const { data } = await API.post<CheckoutQuoteResponse>(
        "/checkout/quote",
        request
      );
      return data.data;
    },
    enabled:
      !!request &&
      !!request.storeId &&
      (options?.enabled ?? true),
    staleTime: 1000 * 30,
  });
};
