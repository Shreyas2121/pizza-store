import type {
  COUPON_CONFLICT_REASONS,
  DISCOUNT_MODES,
  DISCOUNT_TYPES,
  PROMOTION_ERROR_CODES,
  PROMOTION_APPLICATION_STATUSES,
  PROMOTION_DERIVED_STATUSES,
  PROMOTION_INELIGIBILITY_REASONS,
  PROMOTION_KINDS,
  PROMOTION_RULE_TYPES,
  PROMOTION_MEDIA_VARIANTS,
  PROMOTION_SCOPES,
  WEEKDAYS,
} from "./promotion.constants";

export type PromotionKind = (typeof PROMOTION_KINDS)[number];
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];
export type PromotionRuleType = (typeof PROMOTION_RULE_TYPES)[number];
export type DiscountMode = (typeof DISCOUNT_MODES)[number];
export type PromotionApplicationStatus =
  (typeof PROMOTION_APPLICATION_STATUSES)[number];
export type PromotionMediaVariant = (typeof PROMOTION_MEDIA_VARIANTS)[number];
export type PromotionDerivedStatus = (typeof PROMOTION_DERIVED_STATUSES)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type PromotionErrorCode =
  (typeof PROMOTION_ERROR_CODES)[keyof typeof PROMOTION_ERROR_CODES];
export type PromotionIneligibilityReasonCode =
  (typeof PROMOTION_INELIGIBILITY_REASONS)[keyof typeof PROMOTION_INELIGIBILITY_REASONS];
export type CouponConflictReasonCode =
  (typeof COUPON_CONFLICT_REASONS)[keyof typeof COUPON_CONFLICT_REASONS];

export type PercentageDiscount = {
  type: "percentage";
  rateBps: number;
  maxDiscountPaise: number | null;
};

export type FixedAmountDiscount = {
  type: "fixed_amount";
  amountPaise: number;
};

export type PromotionDiscount =
  | PercentageDiscount
  | FixedAmountDiscount
  | { type: "buy_x_get_y" }
  | { type: "free_delivery" }
  | { type: "tiered" };

export type PromotionRule =
  | { type: "product_include"; productId: number }
  | { type: "category_include"; categoryId: number }
  | {
      type: "buy_x_get_y";
      buyQuantity: number;
      getQuantity: number;
      buyProductIds: number[];
      buyCategoryIds: number[];
      getProductIds: number[];
      getCategoryIds: number[];
    }
  | {
      type: "tier";
      minimumSubtotalPaise: number;
      discount: PercentageDiscount | FixedAmountDiscount;
    };

export interface PromotionRecord {
  id: number;
  definitionVersion: number;
  kind: PromotionKind;
  name: string;
  code: string | null;
  discount: PromotionDiscount;
  scope: PromotionScope;
  includeCustomizationValue: boolean;
  minimumOrderPaise: number;
  minimumCartQuantity: number;
  firstOrderOnly: boolean;
  startsAt: Date;
  endsAt: Date;
  activeDaysOfWeek: Weekday[] | null;
  activeStartTime: string | null;
  activeEndTime: string | null;
  perUserRedemptionLimit: number | null;
  maxRedemptions: number | null;
  totalDiscountBudgetPaise: number | null;
  displayPriority: number;
  rules: PromotionRule[];
  isActive: boolean;
}

export interface PromotionItemInput {
  lineId: number;
  productId: number;
  categoryId: number;
  productType: "single" | "bundle";
  quantity: number;
  baseUnitPricePaise: number;
  customizationUnitPricePaise: number;
}

export interface PromotionEvaluationContext {
  now: Date;
  timezone: string;
  storeEnabled: boolean;
  userId: number | null;
  qualifyingOrderCount: number;
  globalRedemptionsUsed: number;
  userRedemptionsUsed: number;
  budgetUsedPaise: number;
  deliveryFeePaise: number;
  items: PromotionItemInput[];
}

export interface PromotionUsageContext {
  storeEnabled: boolean;
  globalRedemptionsUsed: number;
  userRedemptionsUsed: number;
  budgetUsedPaise: number;
}

export interface PromotionResolutionContext {
  now: Date;
  timezone: string;
  userId: number | null;
  qualifyingOrderCount: number;
  deliveryFeePaise: number;
  items: PromotionItemInput[];
  usageByPromotionId: Readonly<Record<number, PromotionUsageContext>>;
}

export type PromotionEligibilityResult =
  | { eligible: true }
  | {
      eligible: false;
      errorCode: PromotionErrorCode;
      reasonCode?: PromotionIneligibilityReasonCode;
    };

export interface PromotionItemAllocation {
  component: "item";
  lineId: number;
  unitIndex: number;
  amountPaise: number;
}

export interface PromotionDeliveryAllocation {
  component: "delivery";
  lineId: null;
  unitIndex: null;
  amountPaise: number;
}

export type PromotionAllocation =
  | PromotionItemAllocation
  | PromotionDeliveryAllocation;

export interface PromotionCandidate {
  promotion: PromotionRecord;
  allocations: PromotionAllocation[];
}

export interface ResolvedPromotion {
  id: number;
  definitionVersion: number;
  kind: PromotionKind;
  name: string;
  code: string | null;
  discountType: DiscountType;
  displayPriority: number;
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  totalSavingsPaise: number;
  allocations: PromotionAllocation[];
}

export interface CouponEligibility {
  eligible: boolean;
  reasonCode: CouponConflictReasonCode | null;
  conflictingLineIds: number[];
}

export interface SuccessfulPromotionResolution {
  ok: true;
  discountMode: DiscountMode;
  promotions: ResolvedPromotion[];
  itemDiscountPaise: number;
  deliveryDiscountPaise: number;
  promotionSavingsPaise: number;
  couponEligibility: CouponEligibility;
}

export interface FailedPromotionResolution {
  ok: false;
  errorCode: PromotionErrorCode;
  reasonCode?: PromotionIneligibilityReasonCode;
  couponEligibility: CouponEligibility;
}

export type PromotionResolution =
  | SuccessfulPromotionResolution
  | FailedPromotionResolution;
