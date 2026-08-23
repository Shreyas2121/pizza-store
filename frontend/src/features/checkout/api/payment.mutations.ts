import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cartKeys } from "@/features/cart";
import { API } from "@/shared/api";
import type {
  InitiateRazorpayOrderRequest,
  RazorpayCheckoutData,
  VerifyRazorpayPaymentRequest,
  VerifyRazorpayPaymentResult,
} from "../model/checkout.types";

type ApiResponse<T> = { data: T; message: string };

export const useInitiateRazorpayOrder = () =>
  useMutation({
    mutationFn: async (request: InitiateRazorpayOrderRequest) =>
      (
        await API.post<ApiResponse<RazorpayCheckoutData>>(
          "/payments/razorpay/orders",
          request
        )
      ).data,
  });

export const useRetryRazorpayOrder = () =>
  useMutation({
    mutationFn: async (localOrderId: number) =>
      (
        await API.post<ApiResponse<RazorpayCheckoutData>>(
          `/payments/razorpay/orders/${localOrderId}/retry`
        )
      ).data,
  });

export const useVerifyRazorpayPayment = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: VerifyRazorpayPaymentRequest) =>
      (
        await API.post<ApiResponse<VerifyRazorpayPaymentResult>>(
          "/payments/razorpay/verify",
          request
        )
      ).data,
    onSuccess: ({ data }) => {
      client.invalidateQueries({ queryKey: cartKeys.get() });
      client.invalidateQueries({ queryKey: cartKeys.checkout() });
      client.invalidateQueries({ queryKey: cartKeys.count() });
      client.invalidateQueries({
        queryKey: ["order-single", data.localOrderId],
      });
      client.invalidateQueries({ queryKey: ["order-all"] });
    },
  });
};
