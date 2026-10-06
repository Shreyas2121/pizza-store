import type {
  promotionsTable,
  promotionRulesTable,
  storePromotionSettingsTable,
} from "../../db/schema";
import {
  promotionDefinitionWriteSchema,
  type PromotionDefinitionWriteInput,
} from "./promotion.schemas";
import type { PromotionRecord } from "./promotion.types";

export type PromotionRow = typeof promotionsTable.$inferSelect;
export type RuleRow = typeof promotionRulesTable.$inferSelect;
export type SettingRow = typeof storePromotionSettingsTable.$inferSelect;
export interface PromotionUsage {
  redemptions: string;
  budgetPaise: string;
}
export const emptyPromotionUsage: PromotionUsage = {
  redemptions: "0",
  budgetPaise: "0",
};

export const definitionFromRows = (
  row: PromotionRow,
  rows: RuleRow[],
): PromotionDefinitionWriteInput => {
  const buy = rows.filter((rule) => rule.ruleType === "bxgy_buy");
  const get = rows.filter((rule) => rule.ruleType === "bxgy_get");
  const rules: unknown[] = rows.flatMap((rule): unknown[] => {
    switch (rule.ruleType) {
      case "product_include":
        return [{ type: "product_include", productId: rule.productId }];
      case "category_include":
        return [{ type: "category_include", categoryId: rule.categoryId }];
      case "tier":
        return [
          {
            type: "tier",
            minimumSubtotalPaise: rule.tierMinPaise,
            discount:
              rule.tierDiscountType === "percentage"
                ? {
                    type: "percentage",
                    rateBps: rule.tierDiscountRateBps,
                    maxDiscountPaise: rule.tierMaxDiscountPaise,
                  }
                : {
                    type: "fixed_amount",
                    amountPaise: rule.tierDiscountAmountPaise,
                  },
          },
        ];
      default:
        return [];
    }
  });
  if (buy.length || get.length) {
    if (
      new Set(buy.map((rule) => rule.quantity)).size !== 1 ||
      new Set(get.map((rule) => rule.quantity)).size !== 1
    ) {
      throw new Error("Inconsistent persisted BXGY quantities");
    }
    rules.push({
      type: "buy_x_get_y",
      buyQuantity: buy[0]?.quantity,
      getQuantity: get[0]?.quantity,
      buyProductIds: buy.flatMap((r) =>
        r.productId === null ? [] : [r.productId],
      ),
      buyCategoryIds: buy.flatMap((r) =>
        r.categoryId === null ? [] : [r.categoryId],
      ),
      getProductIds: get.flatMap((r) =>
        r.productId === null ? [] : [r.productId],
      ),
      getCategoryIds: get.flatMap((r) =>
        r.categoryId === null ? [] : [r.categoryId],
      ),
    });
  }
  // Validate the database boundary, including weekday arrays and discriminated rules.
  return promotionDefinitionWriteSchema.parse({
    kind: row.kind,
    name: row.name,
    description: row.description,
    code: row.code,
    discount:
      row.discountType === "percentage"
        ? {
            type: row.discountType,
            rateBps: row.discountRateBps,
            maxDiscountPaise: row.maxDiscountPaise,
          }
        : row.discountType === "fixed_amount"
          ? { type: row.discountType, amountPaise: row.discountAmountPaise }
          : { type: row.discountType },
    scope: row.scope,
    includeCustomizationValue: row.includeCustomizationValue,
    eligibility: {
      minimumOrderPaise: row.minimumOrderPaise,
      minimumCartQuantity: row.minimumCartQuantity,
      firstOrderOnly: row.firstOrderOnly,
    },
    validity: {
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      activeDaysOfWeek: row.activeDaysOfWeek,
      activeStartTime: row.activeStartTime?.slice(0, 5) ?? null,
      activeEndTime: row.activeEndTime?.slice(0, 5) ?? null,
    },
    limits: {
      perUserRedemptions: row.perUserRedemptionLimit,
      globalRedemptions: row.maxRedemptions,
      budgetPaise: row.totalDiscountBudgetPaise,
    },
    display: {
      priority: row.displayPriority,
      showOnHomepage: row.showOnHomepage,
    },
    rules,
    isActive: row.isActive,
  });
};

export const promotionStatus = (
  row: PromotionRow,
  usage: PromotionUsage,
  now: Date,
) => {
  if (!row.isActive) return "inactive";
  if (now < row.startsAt) return "scheduled";
  if (now >= row.endsAt) return "expired";
  if (
    (row.maxRedemptions !== null &&
      BigInt(usage.redemptions) >= BigInt(row.maxRedemptions)) ||
    (row.totalDiscountBudgetPaise !== null &&
      BigInt(usage.budgetPaise) >= BigInt(row.totalDiscountBudgetPaise))
  )
    return "exhausted";
  return "active";
};

export const toPromotionAdminDto = (
  row: PromotionRow,
  rules: RuleRow[],
  usage: PromotionUsage,
  now: Date,
) => ({
  ...definitionFromRows(row, rules),
  id: row.id,
  definitionVersion: row.definitionVersion,
  display: {
    priority: row.displayPriority,
    showOnHomepage: row.showOnHomepage,
    imageUrl: row.imageUrl,
    mobileImageUrl: row.mobileImageUrl,
    imageAlt: row.imageAlt,
  },
  status: promotionStatus(row, usage, now),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toEffectiveStoreDto = (
  row: PromotionRow,
  rules: RuleRow[],
  usage: PromotionUsage,
  now: Date,
  storeId: number,
  setting?: SettingRow,
) => {
  const dto = toPromotionAdminDto(row, rules, usage, now);
  const promotion = {
    id: dto.id,
    definitionVersion: dto.definitionVersion,
    kind: dto.kind,
    name: dto.name,
    description: dto.description,
    code: dto.code,
    discount: dto.discount,
    scope: dto.scope,
    includeCustomizationValue: dto.includeCustomizationValue,
    eligibility: dto.eligibility,
    validity: dto.validity,
    limits: dto.limits,
    rules: dto.rules,
    isActive: dto.isActive,
    status: dto.status,
  };
  return {
    promotion,
    storeId,
    explicitSetting: setting
      ? {
          enabled: setting.isEnabled,
          reason: setting.disabledReason,
          updatedByUserId: setting.updatedByUserId,
          updatedAt: setting.updatedAt.toISOString(),
        }
      : null,
    effectiveEnabled: row.isActive && (setting?.isEnabled ?? true),
    effectiveStatus: !row.isActive
      ? "globally_inactive"
      : setting?.isEnabled === false
        ? "store_disabled"
        : "enabled",
    canToggle: true,
  };
};

export const toPublicOfferDto = (
  row: PromotionRow,
  rows: RuleRow[],
  timezone: string,
) => {
  if (row.kind !== "offer")
    throw new Error("Coupon cannot be mapped to a public offer");
  const definition = definitionFromRows(row, rows);
  const productIds = new Set<number>();
  const categoryIds = new Set<number>();
  for (const rule of definition.rules) {
    if (rule.type === "product_include") productIds.add(rule.productId);
    if (rule.type === "category_include") categoryIds.add(rule.categoryId);
    if (rule.type === "buy_x_get_y") {
      [...rule.buyProductIds, ...rule.getProductIds].forEach((id) =>
        productIds.add(id),
      );
      [...rule.buyCategoryIds, ...rule.getCategoryIds].forEach((id) =>
        categoryIds.add(id),
      );
    }
  }
  return {
    id: row.id,
    definitionVersion: row.definitionVersion,
    kind: "offer" as const,
    name: row.name,
    description: row.description,
    discount: definition.discount,
    scope: row.scope,
    eligibilitySummary: {
      ...definition.eligibility,
      ...definition.validity,
      timezone,
    },
    targets: {
      productIds: [...productIds].sort((a, b) => a - b),
      categoryIds: [...categoryIds].sort((a, b) => a - b),
    },
    rules: definition.rules,
    display: {
      priority: row.displayPriority,
      imageUrl: row.imageUrl,
      mobileImageUrl: row.mobileImageUrl,
      imageAlt: row.imageAlt,
    },
  };
};

export const toPromotionRecord = (
  row: PromotionRow,
  rules: RuleRow[],
): PromotionRecord => {
  const value = definitionFromRows(row, rules);
  return {
    id: row.id,
    definitionVersion: row.definitionVersion,
    kind: row.kind,
    name: row.name,
    code: row.code,
    discount: value.discount,
    scope: row.scope,
    includeCustomizationValue: row.includeCustomizationValue,
    ...value.eligibility,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    activeDaysOfWeek: value.validity.activeDaysOfWeek,
    activeStartTime: value.validity.activeStartTime,
    activeEndTime: value.validity.activeEndTime,
    perUserRedemptionLimit: row.perUserRedemptionLimit,
    maxRedemptions: row.maxRedemptions,
    totalDiscountBudgetPaise: row.totalDiscountBudgetPaise,
    displayPriority: row.displayPriority,
    rules: value.rules,
    isActive: row.isActive,
  };
};

export const definitionToValues = (
  value: PromotionDefinitionWriteInput,
): typeof promotionsTable.$inferInsert => ({
  kind: value.kind,
  name: value.name,
  description: value.description,
  code: value.code,
  discountType: value.discount.type,
  discountRateBps:
    value.discount.type === "percentage" ? value.discount.rateBps : null,
  discountAmountPaise:
    value.discount.type === "fixed_amount" ? value.discount.amountPaise : null,
  maxDiscountPaise:
    value.discount.type === "percentage"
      ? value.discount.maxDiscountPaise
      : null,
  scope: value.scope,
  includeCustomizationValue: value.includeCustomizationValue,
  ...value.eligibility,
  startsAt: new Date(value.validity.startsAt),
  endsAt: new Date(value.validity.endsAt),
  activeDaysOfWeek: value.validity.activeDaysOfWeek,
  activeStartTime: value.validity.activeStartTime,
  activeEndTime: value.validity.activeEndTime,
  perUserRedemptionLimit: value.limits.perUserRedemptions,
  maxRedemptions: value.limits.globalRedemptions,
  totalDiscountBudgetPaise: value.limits.budgetPaise,
  displayPriority: value.display.priority,
  showOnHomepage: value.display.showOnHomepage,
  isActive: value.isActive,
});

export const rulesToValues = (
  promotionId: number,
  rules: PromotionDefinitionWriteInput["rules"],
): Array<typeof promotionRulesTable.$inferInsert> =>
  rules.flatMap((rule): Array<typeof promotionRulesTable.$inferInsert> => {
    switch (rule.type) {
      case "product_include":
        return [
          { promotionId, ruleType: rule.type, productId: rule.productId },
        ];
      case "category_include":
        return [
          { promotionId, ruleType: rule.type, categoryId: rule.categoryId },
        ];
      case "tier":
        return [
          {
            promotionId,
            ruleType: rule.type,
            tierMinPaise: rule.minimumSubtotalPaise,
            tierDiscountType: rule.discount.type,
            tierDiscountRateBps:
              rule.discount.type === "percentage"
                ? rule.discount.rateBps
                : null,
            tierMaxDiscountPaise:
              rule.discount.type === "percentage"
                ? rule.discount.maxDiscountPaise
                : null,
            tierDiscountAmountPaise:
              rule.discount.type === "fixed_amount"
                ? rule.discount.amountPaise
                : null,
          },
        ];
      case "buy_x_get_y":
        return [
          ...rule.buyProductIds.map((productId) => ({
            promotionId,
            ruleType: "bxgy_buy" as const,
            productId,
            quantity: rule.buyQuantity,
          })),
          ...rule.buyCategoryIds.map((categoryId) => ({
            promotionId,
            ruleType: "bxgy_buy" as const,
            categoryId,
            quantity: rule.buyQuantity,
          })),
          ...rule.getProductIds.map((productId) => ({
            promotionId,
            ruleType: "bxgy_get" as const,
            productId,
            quantity: rule.getQuantity,
          })),
          ...rule.getCategoryIds.map((categoryId) => ({
            promotionId,
            ruleType: "bxgy_get" as const,
            categoryId,
            quantity: rule.getQuantity,
          })),
        ];
    }
  });
