import type { LowStockAlert } from "../inventory/inventory.logic";

export interface InitiateRazorpayOrderInput {
  userId: number;
  addressId: number;
  couponCode?: string | null;
  clientRequestId: string;
}

export interface VerifyRazorpayPaymentInput {
  userId: number;
  localOrderId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface FinalizeCapturedPaymentInput {
  localOrderId: number;
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  providerStatus: "captured";
  userId?: number;
}

export interface LocalRazorpayAttempt {
  localOrderId: number;
  localPaymentId: number;
  userId: number;
  storeId: number;
  storeName: string;
  grandTotalPaise: number | null;
  couponId: number | null;
  provider: "cod" | "razorpay";
  amountPaise: number;
  currency: "INR";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  providerStatus: string | null;
  providerOrderId: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  lowStockAlerts?: LowStockAlert[];
}

