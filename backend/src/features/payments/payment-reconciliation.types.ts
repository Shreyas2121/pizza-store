import type { OrderStatus, PaymentStatus } from "../../utils/types";

export interface PaymentReconciliationOutcome {
  localOrderId: number;
  localPaymentId: number;
  totalPrice?: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  finalizedNow: boolean;
}

export interface IgnoredPaymentReconciliationOutcome {
  ignored: true;
  finalizedNow: false;
}

export type ProviderPaymentReconciliationResult =
  | PaymentReconciliationOutcome
  | IgnoredPaymentReconciliationOutcome;

export interface ReconcileProviderPaymentOptions {
  userId?: number;
  requireCaptured?: boolean;
  failureCode?: string | null;
  failureDescription?: string | null;
}

export type ReconcileProviderPayment = (
  providerOrderId: string,
  providerPaymentId: string,
  options?: ReconcileProviderPaymentOptions
) => Promise<ProviderPaymentReconciliationResult>;
