import { createMutation } from "@/shared/api";

export const useProcessCodPayment = () => {
  return createMutation<{
    paymentId: number;
    paymentType: string;
    message: string;
  }>("/payments/process-cod", "post", [], "data");
};
