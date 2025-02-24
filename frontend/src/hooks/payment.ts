import { useMutation } from "@tanstack/react-query";
import { API } from "../lib/axios";

export const useProcessPayment = () => {
  return useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await API.post(
        "/payments/initiateRazorpay",
        paymentData
      );
      return data.data as {
        paymentId: number;
        orderId: any;
        amount: number;
      };
    },
  });
};

export const useValidatePayment = () => {
  return useMutation({
    mutationFn: async (paymentData: any) => {
      const { data } = await API.post("/payments/validate", paymentData);
      return data.message as string;
    },
  });
};
