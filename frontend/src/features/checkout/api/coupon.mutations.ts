import { useMutation } from "@tanstack/react-query";
import { API } from "@/shared/api";
import { Coupon } from "../model/checkout.types";

export const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (cData: { code: string; total: number }) => {
      const { data } = await API.post(`/coupon/validate`, cData);
      return data.data as Coupon;
    },
  });
};

export const useRedeemCoupon = () => {
  return useMutation({
    mutationFn: async (obj: { code: string; orderId: number }) => {
      const { data } = await API.post(`/coupon/redeem`, obj);
      return data.data;
    },
  });
};
