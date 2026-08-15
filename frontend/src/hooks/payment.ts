import { createMutation } from "./useApi";

const useProcessPayment = () => {
  return createMutation<{
    paymentId: number;
    orderId: any;
    amount: number;
  }>("/payments/initiateRazorpay", "post", [], "data");
};

const useValidatePayment = () => {
  return createMutation<string>("/payments/validate", "post", [], "message");
};

export const PAYMENTS_API_HOOKS = {
  useProcessPayment,
  useValidatePayment,
};
