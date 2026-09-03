import type {
  PaymentCurrency,
  RazorpayOrderStatus,
  RazorpayPaymentStatus,
} from "../../utils/types";

export type RazorpayNotes = Record<string, string | number>;

export interface CreateRazorpayOrderInput {
  amountPaise: number;
  currency: PaymentCurrency;
  receipt: string;
  notes?: RazorpayNotes;
}

export interface RazorpayOrderSnapshot {
  id: string;
  amountPaise: number;
  amountPaidPaise: number;
  amountDuePaise: number;
  currency: string;
  receipt: string | null;
  status: RazorpayOrderStatus;
  attempts: number;
}

export interface RazorpayPaymentSnapshot {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: RazorpayPaymentStatus;
}

export interface CreateRazorpayRefundInput {
  paymentId: string;
  amountPaise: number;
  receipt: string;
  notes?: RazorpayNotes;
}

export interface RazorpayRefundSnapshot {
  id: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  status: "pending" | "processed" | "failed";
  receipt: string | null;
}

export interface RazorpayGateway {
  createOrder(input: CreateRazorpayOrderInput): Promise<RazorpayOrderSnapshot>;
  findOrderByReceipt(receipt: string): Promise<RazorpayOrderSnapshot | null>;
  fetchOrder(orderId: string): Promise<RazorpayOrderSnapshot>;
  fetchOrderPayments(orderId: string): Promise<RazorpayPaymentSnapshot[]>;
  fetchPayment(paymentId: string): Promise<RazorpayPaymentSnapshot>;
  createRefund(input: CreateRazorpayRefundInput): Promise<RazorpayRefundSnapshot>;
  findRefundByReceipt(paymentId: string, receipt: string): Promise<RazorpayRefundSnapshot | null>;
}

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

export interface RazorpayServerConfig extends RazorpayCredentials {
  webhookSecret: string;
  mode?: "simulator" | "razorpay_test";
}
