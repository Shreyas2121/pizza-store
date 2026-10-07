import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/features/auth";
import { API } from "@/shared/api";
import type { RazorpayCheckoutData } from "../model/checkout.types";

export const paymentKeys = {
  status: (orderId: number, userId: number | null) => ["payment-status", orderId, userId] as const,
};

export const shouldPollPayment = (payment?: RazorpayCheckoutData) => !payment ||
  (payment.orderStatus === "awaiting_payment" && (payment.paymentStatus === "pending" || payment.paymentStatus === "processing"));

export const usePaymentOrderStatus = (orderId: number) => {
  const { user, isLoggedIn } = useUser();
  return useQuery({
    queryKey: paymentKeys.status(orderId, user?.id ?? null),
    enabled: isLoggedIn && user?.id !== undefined && Number.isSafeInteger(orderId) && orderId > 0,
    queryFn: async ({ signal }) => (await API.get<{ data: RazorpayCheckoutData }>(`/payments/razorpay/orders/${orderId}`, { signal })).data.data,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => query.state.error ? false : shouldPollPayment(query.state.data) ? 5000 : false,
    refetchIntervalInBackground: false,
  });
};

export type PaymentReconciliationResult = {
  checked: number;
  finalized: number;
  failed: number;
  errors: number;
  results: Array<{
    providerOrderId: string | null;
    status: "finalized" | "failed" | "unchanged" | "error";
    localOrderId?: number;
    totalPrice?: number;
    finalizedNow?: boolean;
    error?: string;
  }>;
};

export const useReconcilePayments = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { olderThanMinutes: number; limit: number }) => (await API.post<{ data: PaymentReconciliationResult; message: string }>("/payments/razorpay/reconcile", input)).data,
    retry: false,
    onSuccess: async () => {
      await Promise.all(["order-single", "order-all", "order-adminAll", "payment-status", "dashboard", "dash-home-cards", "dash-home-charts", "finance", "cart", "catalog"].map((key) => client.invalidateQueries({ queryKey: [key] })));
    },
  });
};
