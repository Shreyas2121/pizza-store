import { Stack, Text } from "@mantine/core";
import {
  describeDiscount,
  formatPromotionAggregate,
} from "../model/promotion.helpers";
import { WEEKDAY_LABELS } from "../model/promotion.constants";
import type { StorePromotion } from "../model/promotion.types";

export const PromotionDefinitionSummary = ({
  promotion,
  timezone,
}: {
  promotion: StorePromotion["promotion"];
  timezone?: string;
}) => (
  <Stack gap="xs">
    <Text>{promotion.description}</Text>
    <Text size="sm">
      {describeDiscount(promotion.discount)} · {promotion.scope} scope ·{" "}
      {promotion.includeCustomizationValue
        ? "Includes customization value"
        : "Base product value only"}
    </Text>
    {promotion.code && (
      <Text size="sm">Manual coupon code: {promotion.code}</Text>
    )}
    <Text size="sm">
      Minimum order{" "}
      {formatPromotionAggregate(
        String(promotion.eligibility.minimumOrderPaise),
      )}{" "}
      · Minimum quantity {promotion.eligibility.minimumCartQuantity}
      {promotion.eligibility.firstOrderOnly ? " · First order only" : ""}
    </Text>
    <Text size="sm">
      Starts {promotion.validity.startsAt} · Ends {promotion.validity.endsAt}{" "}
      (exclusive, UTC)
    </Text>
    <Text size="sm">
      Local days:{" "}
      {promotion.validity.activeDaysOfWeek
        ?.map((day) => WEEKDAY_LABELS[day])
        .join(", ") ?? "Every day"}{" "}
      · Local window:{" "}
      {promotion.validity.activeStartTime
        ? `${promotion.validity.activeStartTime}–${promotion.validity.activeEndTime}`
        : "All day"}
      . Times use {timezone ?? "this store’s configured timezone"}; overnight
      windows belong to the starting day.
    </Text>
    <Text size="sm">
      Per-user limit: {promotion.limits.perUserRedemptions ?? "Unlimited"} ·
      Global limit: {promotion.limits.globalRedemptions ?? "Unlimited"} · Global
      budget:{" "}
      {promotion.limits.budgetPaise === null
        ? "Unlimited"
        : formatPromotionAggregate(String(promotion.limits.budgetPaise))}
    </Text>
    {!!promotion.rules.length && (
      <ul className="list-disc pl-5 text-sm">
        {promotion.rules.map((rule, index) => (
          <li key={index}>
            {rule.type === "product_include"
              ? `Product #${rule.productId}`
              : rule.type === "category_include"
              ? `Category #${rule.categoryId}`
              : rule.type === "tier"
              ? `From ${formatPromotionAggregate(
                  String(rule.minimumSubtotalPaise),
                )}: ${describeDiscount(rule.discount)}`
              : `Buy ${rule.buyQuantity} (products: ${
                  rule.buyProductIds.join(", ") || "none"
                }; categories: ${
                  rule.buyCategoryIds.join(", ") || "none"
                }), get ${rule.getQuantity} (products: ${
                  rule.getProductIds.join(", ") || "none"
                }; categories: ${rule.getCategoryIds.join(", ") || "none"})`}
          </li>
        ))}
      </ul>
    )}
  </Stack>
);
