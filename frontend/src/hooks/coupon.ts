import { useMutation } from "@tanstack/react-query";
import { Coupon } from "../lib/types";
import { API } from "../lib/axios";

export const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (cData: any) => {
      const { data } = await API.post(`/coupon/validate`, cData);
      return data.data as Coupon;
    },
  });
};

export const useRedeemCoupon = () => {
  return useMutation({
    mutationFn: async (obj: any) => {
      const { data } = await API.post(`/coupon/redeem`, obj);
      return data.data;
    },
  });
};
