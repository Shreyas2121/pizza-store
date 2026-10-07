export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";
export type PaymentType = "cash" | "razorpay";
export type PaymentProvider = "cod" | "razorpay";

export type PaymentMethods = {
  cash: true;
  razorpay: boolean;
  providerMode: "simulator" | "razorpay_test";
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
  baseUnitPricePaise: number;
  customizationUnitPricePaise: number;
  itemDiscountPaise: number;
  productType: "single" | "bundle";
  compareAtUnitPricePaise: number | null;
  bundleMarkdownPaise: number;
  bundleComponents: { productId: number; name: string; quantityPerBundle: number; totalQuantity: number; isAvailable: boolean }[];
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

export type PromotionSnapshot = {
  id: number;
  kind: "offer" | "coupon";
  name: string;
  code: string | null;
  discountType: "percentage" | "fixed_amount" | "buy_x_get_y" | "free_delivery" | "tiered";
  definitionVersion: number;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
};
export type QuotePromotion = PromotionSnapshot & {
  applied: true;
  allocations: { lineId: number | null; component: "item" | "delivery"; unitIndexes: number[]; amountPaise: number }[];
};

export type PricingQuote = {
  quoteVersion: string;
  currency: "INR";
  pricingPolicyVersion: number;
  itemsSubtotalPaise: number;
  discountMode: "none" | "automatic_deals" | "coupon";
  itemDiscountPaise: number;
  standardDeliveryFeePaise: number;
  chargedDeliveryFeePaise: number;
  deliveryDiscountPaise: number;
  promotionSavingsPaise: number;
  bundleMarkdownPaise: number;
  totalDisplayedSavingsPaise: number;
  roundingAdjustmentPaise: number;
  grandTotalPaise: number;
  taxableAmountPaise: number;
  taxPaise: number;
  items: PricingQuoteItem[];
  promotions: QuotePromotion[];
  couponEligibility: { eligible: boolean; reasonCode: "OFFER_APPLIED" | "DEAL_BUNDLE_PRESENT" | null; conflictingLineIds: number[] };
  deliveryPricing: {
    ruleId: number;
    ruleVersion: number;
    storeId: number;
    businessDate: string;
    timezone: string;
    standardFeePaise: number;
    chargedFeePaise: number;
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
  providerMode: "simulator" | "razorpay_test";
  razorpayOrderId: string | null;
  amountPaise: number;
  currency: "INR";
  name: string;
  description: string;
  paymentStatus: PaymentStatus;
  providerStatus: string | null;
  checkoutReady: boolean;
  discountMode: PricingQuote["discountMode"];
  orderStatus: VerifyRazorpayPaymentResult["orderStatus"];
  promotions: PromotionSnapshot[];
  failure: RazorpayFailure | null;
};

export type SimulatorScenario =
  | "successful"
  | "failed"
  | "delayed"
  | "duplicate"
  | "out_of_order";

export type SimulatorEventResult = {
  reconciliation: VerifyRazorpayPaymentResult | null;
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
