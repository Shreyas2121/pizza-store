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

export interface PaymentAttemptDTO {
  id: number;
  orderId: number;
  storeId: number;
  provider: "cod" | "razorpay";
  method: "cash" | "card" | "upi" | "netbanking" | "wallet" | "other" | null;
  status:
    | "pending"
    | "processing"
    | "authorized"
    | "captured"
    | "failed"
    | "expired"
    | "cancelled"
    | "voided";
  providerStatus: string | null;
  amountPaise: number;
  currency: "INR";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  clientRequestId: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  authorizedAt: Date | null;
  capturedAt: Date | null;
  failedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentAttemptInput {
  orderId: number;
  storeId: number;
  provider: "cod" | "razorpay";
  method?: "cash" | "card" | "upi" | "netbanking" | "wallet" | "other" | null;
  status?:
    | "pending"
    | "processing"
    | "authorized"
    | "captured"
    | "failed"
    | "expired"
    | "cancelled"
    | "voided";
  providerStatus?: string | null;
  amountPaise: number;
  currency?: "INR";
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  clientRequestId?: string | null;
  failureCode?: string | null;
  failureDescription?: string | null;
  authorizedAt?: Date | null;
  capturedAt?: Date | null;
  failedAt?: Date | null;
  expiresAt?: Date | null;
}
