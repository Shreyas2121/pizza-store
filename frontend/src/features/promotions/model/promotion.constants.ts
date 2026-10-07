// Frozen wire limits: docs/promotions-contract.md and backend promotion.constants.ts.
export const MAX_POSTGRES_INT = 2_147_483_647;
export const MONEY_CAPS = { ORDER_AMOUNT: 500_000, DISCOUNT: 500_000 } as const;
export const BASIS_POINTS_SCALE = 10_000;
export const DEFAULT_PERCENTAGE_RATE_BPS = 1_000;
export const PROMOTION_CODE_MAX_LENGTH = 64;
export const PROMOTION_NAME_MAX_LENGTH = 120;
export const PROMOTION_DESCRIPTION_MAX_LENGTH = 1_000;
export const PROMOTION_IMAGE_ALT_MAX_LENGTH = 200;
export const STORE_PROMOTION_REASON_MAX_LENGTH = 500;
export const PROMOTION_LIST_DEFAULT_PAGE_SIZE = 25;
export const PROMOTION_LIST_MAX_PAGE_SIZE = 100;
export const PROMOTION_LIST_MAX_PAGE = 21_474_836;
export const PROMOTION_PAGE_SIZE_OPTIONS = [
  PROMOTION_LIST_DEFAULT_PAGE_SIZE,
  50,
  PROMOTION_LIST_MAX_PAGE_SIZE,
];
export const PROMOTION_QUERY_RETRY_LIMIT = 2;
export const PROMOTION_MAX_EXPANDED_UNITS = 10_000;
export const PROMOTION_IMAGE_MAX_BYTES = 5_242_880;
export const PROMOTION_DESKTOP_MIN_WIDTH = 1_200;
export const PROMOTION_DESKTOP_MIN_HEIGHT = 400;
export const PROMOTION_MOBILE_MIN_WIDTH = 600;
export const PROMOTION_MOBILE_MIN_HEIGHT = 600;
export const PROMOTION_IMAGE_MAX_WIDTH = 4_096;
export const PROMOTION_IMAGE_MAX_HEIGHT = 2_160;
export const PROMOTION_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export const PROMOTION_ANALYTICS_FIRST_DATE = "0001-01-01";
export const PROMOTION_ANALYTICS_LAST_DATE = "9999-12-31";
export const PROMOTION_KINDS = ["offer", "coupon"] as const;
export const PROMOTION_SCOPES = [
  "cart",
  "product",
  "category",
  "delivery",
] as const;
export const PROMOTION_MEDIA_VARIANTS = ["desktop", "mobile"] as const;
export const PROMOTION_DERIVED_STATUSES = [
  "scheduled",
  "active",
  "expired",
  "exhausted",
  "inactive",
] as const;
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
