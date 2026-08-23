import { useMutation } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { Coupon } from "../model/checkout.types";

export const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (cData: { code: string }) => {
      const { data } = await API.post(`/coupon/validate`, cData);
      return data.data as Coupon;
    },
  });
};
