import axios from "axios";
import type { UserAccessResponse } from "@/features/access";
import type {
  Promotion,
  PromotionDefinition,
  PromotionDiscount,
} from "./promotion.types";
import {
  DEFAULT_PERCENTAGE_RATE_BPS,
  PROMOTION_QUERY_RETRY_LIMIT,
} from "./promotion.constants";

export const retryPromotionQuery = (failureCount: number, error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    error.response &&
    error.response.status >= 400 &&
    error.response.status < 500
  )
    return false;
  return failureCount < PROMOTION_QUERY_RETRY_LIMIT;
};

export const defaultDiscount = (
  type: PromotionDiscount["type"],
): PromotionDiscount => {
  if (type === "percentage")
    return {
      type,
      rateBps: DEFAULT_PERCENTAGE_RATE_BPS,
      maxDiscountPaise: null,
    };
  if (type === "fixed_amount") return { type, amountPaise: 0 };
  return { type };
};

export const canManageStorePromotions = (
  access: UserAccessResponse | undefined,
  storeId: number | null,
) =>
  access?.platformRole === "user" &&
  access.memberships.some(
    (membership) =>
      membership.store.id === storeId &&
      membership.role === "manager" &&
      membership.permissions.includes("store.promotions.toggle"),
  );

export const promotionErrorCode = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) return undefined;
  const body: unknown = error.response?.data;
  return body &&
    typeof body === "object" &&
    "code" in body &&
    typeof body.code === "string"
    ? body.code
    : undefined;
};
export const promotionErrorMessage = (error: unknown) => {
  switch (promotionErrorCode(error)) {
    case "PERMISSION_DENIED":
      return "You do not have permission to perform this action.";
    case "PROMOTION_VERSION_CONFLICT":
      return "This definition has changed. Your edits are preserved. Reload the latest version before editing again.";
    case "PROMOTION_MEDIA_REQUIRED_FOR_HOMEPAGE":
      return "Upload a desktop image with meaningful alt text before enabling homepage placement.";
    case "PROMOTION_MEDIA_INVALID":
      return "The image does not meet the format, size, dimension or alt-text requirements.";
    case "PROMOTION_NOT_FOUND":
      return "This promotion no longer exists.";
    case "PROMOTION_CAPACITY_EXHAUSTED":
      return "The redemption limit cannot be lower than currently reserved and consumed applications.";
    case "PROMOTION_BUDGET_EXHAUSTED":
      return "The budget cannot be lower than currently reserved and consumed savings.";
    case "PROMOTION_INVALID_DEFINITION":
      return "The server rejected the definition. Check its rules, targets and coupon code.";
    case "STORE_PROMOTION_REASON_REQUIRED":
      return "A reason is required to disable participation.";
    default:
      return "The request could not be completed. Try again.";
  }
};
export const definitionFromPromotion = (
  promotion: Promotion,
): PromotionDefinition => ({
  kind: promotion.kind,
  name: promotion.name,
  description: promotion.description,
  code: promotion.code,
  discount: promotion.discount,
  scope: promotion.scope,
  includeCustomizationValue: promotion.includeCustomizationValue,
  eligibility: promotion.eligibility,
  validity: promotion.validity,
  limits: promotion.limits,
  display: {
    priority: promotion.display.priority,
    showOnHomepage: promotion.display.showOnHomepage,
  },
  rules: promotion.rules,
  isActive: promotion.isActive,
});
export const formatPromotionAggregate = (value: string) => {
  const amount = BigInt(value);
  return `₹${(amount / 100n).toLocaleString("en-IN")}.${(amount % 100n)
    .toString()
    .padStart(2, "0")}`;
};
export const describeDiscount = (discount: PromotionDiscount): string => {
  switch (discount.type) {
    case "percentage":
      return `${discount.rateBps / 100}% off${
        discount.maxDiscountPaise === null
          ? ""
          : ` (cap ${formatPromotionAggregate(
              String(discount.maxDiscountPaise),
            )})`
      }`;
    case "fixed_amount":
      return `${formatPromotionAggregate(String(discount.amountPaise))} off`;
    case "buy_x_get_y":
      return "Buy X, get Y free";
    case "free_delivery":
      return "Free delivery";
    case "tiered":
      return "Tiered cart discount";
  }
};
export const newPromotionDefinition = (): PromotionDefinition => ({
  kind: "offer",
  name: "",
  description: "",
  code: null,
  discount: defaultDiscount("percentage"),
  scope: "cart",
  includeCustomizationValue: false,
  eligibility: {
    minimumOrderPaise: 0,
    minimumCartQuantity: 0,
    firstOrderOnly: false,
  },
  validity: {
    startsAt: "",
    endsAt: "",
    activeDaysOfWeek: null,
    activeStartTime: null,
    activeEndTime: null,
  },
  limits: {
    perUserRedemptions: null,
    globalRedemptions: null,
    budgetPaise: null,
  },
  display: { priority: 0, showOnHomepage: false },
  rules: [],
  isActive: false,
});

export const utcInputToIso = (value: string): string => {
  if (!value) return "";
  const date = new Date(`${value}Z`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
};
