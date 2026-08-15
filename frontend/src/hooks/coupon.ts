import { API, Coupon } from "@/lib";
import { useMutation } from "@tanstack/react-query";

const useValidateCoupon = () => {
  return useMutation({
    mutationFn: async (cData: { code: string; total: number }) => {
      const { data } = await API.post(`/coupon/validate`, cData);
      return data.data as Coupon;
    },
  });
};

const useRedeemCoupon = () => {
  return useMutation({
    mutationFn: async (obj: { code: string; orderId: number }) => {
      const { data } = await API.post(`/coupon/redeem`, obj);
      return data.data;
    },
  });
};

export const COUPON_API_HOOKS = {
  useValidateCoupon,
  useRedeemCoupon,
};
