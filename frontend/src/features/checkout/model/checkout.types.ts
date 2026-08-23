export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";
export type PaymentType = "cash" | "razorpay";
export type PaymentProvider = "cod" | "razorpay";
export type CouponType = "percentage" | "fixed";

export type Payment = {
  status: PaymentStatus;
  provider: PaymentProvider;
  providerStatus: string | null;
  amountPaise: number;
  currency: "INR";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  id: number;
  createdAt: string;
  updatedAt: string;
  paymentDate: string | null;
  paidAt: string | null;
  failedAt: string | null;
};

export type Coupon = {
  id: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  code: string;
  discountType: CouponType;
  discountValue: number;
  minOrderValue: number;
  startDate: string;
  endDate: string;
  redemptionCount: number;
  maxRedemptions: number;
};
