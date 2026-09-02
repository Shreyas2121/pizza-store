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

export type CouponPreview = Coupon & {
  quoteVersion: string;
  currency: "INR";
  pricingPolicyVersion: number;
  itemsSubtotalPaise: number;
  discountPaise: number;
  discountAmount: number;
  grandTotalPaise: number;
};

export type PricingCustomizationSnapshot = {
  customizationOptionId: number;
  name: string;
  pricePaise: number;
};

export type PricingQuoteItem = {
  lineId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPricePaise: number;
  lineSubtotalPaise: number;
  discountAllocationPaise: number;
  taxRuleId: number;
  taxRuleVersion: number;
  taxRateBps: number;
  taxableAmountPaise: number;
  taxPaise: number;
  hsnSacCode: string;
  lineTotalPaise: number;
  customizations: PricingCustomizationSnapshot[];
};

export type TaxRuleSnapshot = {
  ruleId: number;
  ruleVersion: number;
  rateBps: number;
  hsnSacCode: string;
};

export type PricingQuote = {
  quoteVersion: string;
  currency: "INR";
  pricingPolicyVersion: number;
  itemsSubtotalPaise: number;
  discountPaise: number;
  deliveryFeePaise: number;
  roundingAdjustmentPaise: number;
  grandTotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  items: PricingQuoteItem[];
  coupon: {
    id: number;
    code: string;
    discountPaise: number;
    applied: true;
  } | null;
  deliveryPricing: {
    ruleId: number;
    ruleVersion: number;
    storeId: number;
    businessDate: string;
    timezone: string;
    standardFeePaise: number;
    freeDeliveryThresholdPaise: number | null;
    freeDeliveryApplied: boolean;
  };
  tax: {
    calculationPolicyVersion: number;
    isDemo: true;
    disclaimer: string;
    placeOfSupplyState: string;
    placeOfSupplySource: "delivery_address" | "store_estimate";
    itemRule: TaxRuleSnapshot;
    deliveryRule: TaxRuleSnapshot & {
      taxableAmountPaise: number;
      taxPaise: number;
    };
  };
};

export type CheckoutQuoteItemInput = {
  productId: number;
  quantity: number;
  customizationOptionIds?: number[];
};

export type CheckoutQuoteRequest = {
  storeId: number;
  couponCode?: string | null;
  destinationState?: string | null;
  addressId?: number | null;
  items?: CheckoutQuoteItemInput[];
};

export type CheckoutQuoteResponse = {
  data: PricingQuote;
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
  orderStatus:
    | "awaiting_payment"
    | "pending"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled";
  finalizedNow: boolean;
};
