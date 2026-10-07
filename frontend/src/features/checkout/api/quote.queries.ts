import { useQuery } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { useUser } from "@/features/auth";
import type {
  CheckoutQuoteRequest,
  CheckoutQuoteResponse,
  PricingQuote,
} from "../model/checkout.types";

export const checkoutQuoteKeys = {
  all: ["checkout-quote"] as const,
  quote: (req: CheckoutQuoteRequest | null, userId: number | null = null) =>
    [
      "checkout-quote",
      userId,
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
  const { user, isLoggedIn } = useUser();
  return useQuery({
    queryKey: checkoutQuoteKeys.quote(request, isLoggedIn ? user?.id ?? null : null),
    queryFn: async ({ signal }): Promise<PricingQuote | null> => {
      if (!request || !request.storeId) {
        return null;
      }
      const { data } = await API.post<CheckoutQuoteResponse>(
        "/checkout/quote",
        request,
        { signal }
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
