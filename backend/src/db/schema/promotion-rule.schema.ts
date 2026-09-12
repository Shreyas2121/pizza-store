import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_helpers";
import { categoriesTable, productsTable } from "./catalog.schema";
import { promotionsTable } from "./promotion.schema";

export type PromotionRuleTypeValue =
  | "product_include"
  | "category_include"
  | "bxgy_buy"
  | "bxgy_get"
  | "tier";

export const promotionRulesTable = pgTable(
  "promotion_rules",
  {
    id,
    promotionId: integer("promotion_id")
      .references(() => promotionsTable.id, { onDelete: "cascade" })
      .notNull(),
    ruleType: text("rule_type").$type<PromotionRuleTypeValue>().notNull(),
    productId: integer("product_id").references(() => productsTable.id),
    categoryId: integer("category_id").references(() => categoriesTable.id),
    quantity: integer(),
    tierMinPaise: integer("tier_min_paise"),
    tierDiscountType: text("tier_discount_type")
      .$type<"percentage" | "fixed_amount">(),
    tierDiscountRateBps: integer("tier_discount_rate_bps"),
    tierDiscountAmountPaise: integer("tier_discount_amount_paise"),
    tierMaxDiscountPaise: integer("tier_max_discount_paise"),
    createdAt,
  },
  (table) => [
    index("promotion_rules_promotion_type_idx").on(
      table.promotionId,
      table.ruleType,
      table.id
    ),
    index("promotion_rules_product_target_idx").on(
      table.productId,
      table.promotionId
    ),
    index("promotion_rules_category_target_idx").on(
      table.categoryId,
      table.promotionId
    ),
    uniqueIndex("promotion_rules_product_target_unique")
      .on(table.promotionId, table.ruleType, table.productId)
      .where(sql`${table.productId} is not null`),
    uniqueIndex("promotion_rules_category_target_unique")
      .on(table.promotionId, table.ruleType, table.categoryId)
      .where(sql`${table.categoryId} is not null`),
    uniqueIndex("promotion_rules_tier_threshold_unique")
      .on(table.promotionId, table.tierMinPaise)
      .where(sql`${table.ruleType} = 'tier'`),
    check(
      "promotion_rules_type_valid",
      sql`${table.ruleType} in ('product_include', 'category_include', 'bxgy_buy', 'bxgy_get', 'tier')`
    ),
    check(
      "promotion_rules_shape_valid",
      sql`(${table.ruleType} = 'product_include'
          and ${table.productId} is not null and ${table.categoryId} is null
          and ${table.quantity} is null and ${table.tierMinPaise} is null
          and ${table.tierDiscountType} is null and ${table.tierDiscountRateBps} is null
          and ${table.tierDiscountAmountPaise} is null and ${table.tierMaxDiscountPaise} is null)
        or (${table.ruleType} = 'category_include'
          and ${table.productId} is null and ${table.categoryId} is not null
          and ${table.quantity} is null and ${table.tierMinPaise} is null
          and ${table.tierDiscountType} is null and ${table.tierDiscountRateBps} is null
          and ${table.tierDiscountAmountPaise} is null and ${table.tierMaxDiscountPaise} is null)
        or (${table.ruleType} in ('bxgy_buy', 'bxgy_get')
          and ((${table.productId} is not null and ${table.categoryId} is null)
            or (${table.productId} is null and ${table.categoryId} is not null))
          and ${table.quantity} > 0 and ${table.tierMinPaise} is null
          and ${table.tierDiscountType} is null and ${table.tierDiscountRateBps} is null
          and ${table.tierDiscountAmountPaise} is null and ${table.tierMaxDiscountPaise} is null)
        or (${table.ruleType} = 'tier'
          and ${table.productId} is null and ${table.categoryId} is null
          and ${table.quantity} is null and ${table.tierMinPaise} >= 0
          and ((${table.tierDiscountType} = 'percentage'
              and ${table.tierDiscountRateBps} between 1 and 10000
              and ${table.tierDiscountAmountPaise} is null
              and (${table.tierMaxDiscountPaise} is null or ${table.tierMaxDiscountPaise} > 0))
            or (${table.tierDiscountType} = 'fixed_amount'
              and ${table.tierDiscountRateBps} is null
              and ${table.tierDiscountAmountPaise} > 0
              and ${table.tierMaxDiscountPaise} is null)))`
    ),
  ]
);
