import { useMutation } from "@tanstack/react-query";
import { API } from "@/shared/api";
import type { PricingQuote } from "../model/checkout.types";

export const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (cData: { code: string }) => {
      const { data } = await API.post<{ data: PricingQuote }>("/promotions/validate", { couponCode: cData.code });
      return data.data;
    },
  });
};
