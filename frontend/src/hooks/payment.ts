import { createMutation } from "./useApi";

const useProcessCodPayment = () => {
  return createMutation<{
    paymentId: number;
    paymentType: string;
    message: string;
  }>("/payments/process-cod", "post", [], "data");
};

export const PAYMENTS_API_HOOKS = {
  useProcessCodPayment,
};
