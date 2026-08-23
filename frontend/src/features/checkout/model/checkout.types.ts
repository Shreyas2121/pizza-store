export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";
export type PaymentType = "cash" | "razorpay";
export type PaymentProvider = "cod" | "razorpay";
export type CouponType = "percentage" | "fixed";

export type PaymentMethods = {
  cash: true;
  razorpay: boolean;
};

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

export type RazorpayFailure = {
  code: string | null;
  description: string | null;
};

export type RazorpayCheckoutData = {
  localOrderId: number;
  localPaymentId: number;
  keyId: string | null;
  razorpayOrderId: string | null;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  paymentStatus: PaymentStatus;
  providerStatus: string | null;
  checkoutReady: boolean;
  failure: RazorpayFailure | null;
};

export type InitiateRazorpayOrderRequest = {
  addressId: number;
  couponCode?: string | null;
  clientRequestId: string;
};

export type VerifyRazorpayPaymentRequest = {
  localOrderId: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type VerifyRazorpayPaymentResult = {
  localOrderId: number;
  localPaymentId: number;
  totalPrice: number;
  paymentStatus: "completed" | "refunded";
  orderStatus: "pending" | "preparing" | "delievered" | "cancelled";
  finalizedNow: boolean;
};
