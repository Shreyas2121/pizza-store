export const BASIS_POINTS_SCALE = 10_000;
export const PROMOTION_DEFINITION_INITIAL_VERSION = 1;
export const UNLIMITED_PROMOTION_LIMIT = null;

export const PROMOTION_NAME_MAX_LENGTH = 120;
export const PROMOTION_DESCRIPTION_MAX_LENGTH = 1_000;
export const PROMOTION_CODE_MAX_LENGTH = 64;
export const PROMOTION_IMAGE_ALT_MAX_LENGTH = 200;
export const STORE_PROMOTION_REASON_MAX_LENGTH = 500;
export const PROMOTION_LIST_DEFAULT_PAGE_SIZE = 25;
export const PROMOTION_LIST_MAX_PAGE_SIZE = 100;
export const PROMOTION_IMAGE_MAX_BYTES = 5_242_880;
export const PROMOTION_DESKTOP_MIN_WIDTH = 1_200;
export const PROMOTION_DESKTOP_MIN_HEIGHT = 400;
export const PROMOTION_MOBILE_MIN_WIDTH = 600;
export const PROMOTION_MOBILE_MIN_HEIGHT = 600;
export const PROMOTION_IMAGE_MAX_WIDTH = 4_096;
export const PROMOTION_IMAGE_MAX_HEIGHT = 2_160;
export const HOMEPAGE_FEATURED_OFFER_LIMIT = 8;
export const HOMEPAGE_SLIDE_INTERVAL_MS = 6_000;
export const PROMOTION_MEDIA_ORPHAN_MIN_AGE_MS = 86_400_000;

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_BY_SHORT_NAME = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const;

export const PROMOTION_KINDS = ["offer", "coupon"] as const;
export const DISCOUNT_TYPES = [
  "percentage",
  "fixed_amount",
  "buy_x_get_y",
  "free_delivery",
  "tiered",
] as const;
export const PROMOTION_SCOPES = [
  "cart",
  "product",
  "category",
  "delivery",
] as const;
export const PROMOTION_RULE_TYPES = [
  "product_include",
  "category_include",
  "buy_x_get_y",
  "tier",
] as const;
export const DISCOUNT_MODES = [
  "none",
  "automatic_deals",
  "coupon",
] as const;
export const PROMOTION_APPLICATION_STATUSES = [
  "reserved",
  "consumed",
  "released",
] as const;
export const PROMOTION_MEDIA_VARIANTS = ["desktop", "mobile"] as const;
export const PROMOTION_DERIVED_STATUSES = [
  "scheduled",
  "active",
  "expired",
  "exhausted",
  "inactive",
] as const;
export const FIRST_ORDER_DISQUALIFYING_STATUSES = [
  "awaiting_payment",
  "pending",
  "preparing",
  "out_for_delivery",
  "delivered",
] as const;

export const PROMOTION_ERROR_CODES = {
  NOT_FOUND: "PROMOTION_NOT_FOUND",
  INELIGIBLE: "PROMOTION_INELIGIBLE",
  NOT_ACTIVE: "PROMOTION_NOT_ACTIVE",
  DISABLED_FOR_STORE: "PROMOTION_DISABLED_FOR_STORE",
  CAPACITY_EXHAUSTED: "PROMOTION_CAPACITY_EXHAUSTED",
  BUDGET_EXHAUSTED: "PROMOTION_BUDGET_EXHAUSTED",
  VERSION_CONFLICT: "PROMOTION_VERSION_CONFLICT",
  COUPON_NOT_COMBINABLE: "COUPON_NOT_COMBINABLE_WITH_OFFERS",
  INVALID_DEFINITION: "PROMOTION_INVALID_DEFINITION",
  MEDIA_INVALID: "PROMOTION_MEDIA_INVALID",
  MEDIA_REQUIRED_FOR_HOMEPAGE: "PROMOTION_MEDIA_REQUIRED_FOR_HOMEPAGE",
  MEDIA_STORAGE_FAILED: "PROMOTION_MEDIA_STORAGE_FAILED",
  STORE_REASON_REQUIRED: "STORE_PROMOTION_REASON_REQUIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CART_EMPTY: "CART_EMPTY",
} as const;

export const PROMOTION_INELIGIBILITY_REASONS = {
  DATE_RESTRICTED: "DATE_RESTRICTED",
  DAY_RESTRICTED: "DAY_RESTRICTED",
  TIME_RESTRICTED: "TIME_RESTRICTED",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  FIRST_ORDER_REQUIRED: "FIRST_ORDER_REQUIRED",
  PER_USER_LIMIT_REACHED: "PER_USER_LIMIT_REACHED",
  MINIMUM_ORDER_NOT_MET: "MINIMUM_ORDER_NOT_MET",
  MINIMUM_QUANTITY_NOT_MET: "MINIMUM_QUANTITY_NOT_MET",
  PRODUCT_TARGET_NOT_PRESENT: "PRODUCT_TARGET_NOT_PRESENT",
  CATEGORY_TARGET_NOT_PRESENT: "CATEGORY_TARGET_NOT_PRESENT",
} as const;

export const COUPON_CONFLICT_REASONS = {
  OFFER_APPLIED: "OFFER_APPLIED",
  DEAL_BUNDLE_PRESENT: "DEAL_BUNDLE_PRESENT",
} as const;

// Unit-addressed allocations are intentionally bounded before expansion.
// This is a defensive engine limit, not an API merchandising limit.
export const PROMOTION_MAX_EXPANDED_UNITS = 10_000;
