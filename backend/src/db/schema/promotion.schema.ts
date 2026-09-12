import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, isActive, updatedAt } from "./_helpers";

export type PromotionKindValue = "offer" | "coupon";
export type PromotionDiscountTypeValue =
  | "percentage"
  | "fixed_amount"
  | "buy_x_get_y"
  | "free_delivery"
  | "tiered";
export type PromotionScopeValue = "cart" | "product" | "category" | "delivery";

export const promotionsTable = pgTable(
  "promotions",
  {
    id,
    kind: text().$type<PromotionKindValue>().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    code: text(),
    discountType: text("discount_type")
      .$type<PromotionDiscountTypeValue>()
      .notNull(),
    discountRateBps: integer("discount_rate_bps"),
    discountAmountPaise: integer("discount_amount_paise"),
    maxDiscountPaise: integer("max_discount_paise"),
    minimumOrderPaise: integer("minimum_order_paise").default(0).notNull(),
    minimumCartQuantity: integer("minimum_cart_quantity").default(0).notNull(),
    scope: text().$type<PromotionScopeValue>().notNull(),
    includeCustomizationValue: boolean("include_customization_value")
      .default(false)
      .notNull(),
    definitionVersion: integer("definition_version").default(1).notNull(),
    firstOrderOnly: boolean("first_order_only").default(false).notNull(),
    perUserRedemptionLimit: integer("per_user_redemption_limit"),
    activeStartTime: time("active_start_time"),
    activeEndTime: time("active_end_time"),
    activeDaysOfWeek: integer("active_days_of_week").array(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    maxRedemptions: integer("max_redemptions"),
    totalDiscountBudgetPaise: integer("total_discount_budget_paise"),
    displayPriority: integer("display_priority").default(0).notNull(),
    imageUrl: text("image_url"),
    mobileImageUrl: text("mobile_image_url"),
    imageAlt: text("image_alt"),
    showOnHomepage: boolean("show_on_homepage").default(false).notNull(),
    isActive,
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("promotions_normalized_code_unique")
      .on(sql`upper(btrim(${table.code}))`)
      .where(sql`${table.code} is not null`),
    index("promotions_active_discovery_idx").on(
      table.kind,
      table.isActive,
      table.startsAt,
      table.endsAt,
      table.displayPriority,
      table.id
    ),
    index("promotions_capacity_budget_idx").on(
      table.isActive,
      table.maxRedemptions,
      table.totalDiscountBudgetPaise,
      table.id
    ),
    check("promotions_kind_valid", sql`${table.kind} in ('offer', 'coupon')`),
    check(
      "promotions_name_description_valid",
      sql`nullif(btrim(${table.name}), '') is not null
        and char_length(${table.name}) <= 120
        and nullif(btrim(${table.description}), '') is not null
        and char_length(${table.description}) <= 1000`
    ),
    check(
      "promotions_kind_code_consistency",
      sql`(${table.kind} = 'offer' and ${table.code} is null)
        or (${table.kind} = 'coupon'
          and nullif(btrim(${table.code}), '') is not null
          and ${table.code} = upper(btrim(${table.code}))
          and char_length(${table.code}) <= 64)`
    ),
    check(
      "promotions_discount_type_valid",
      sql`${table.discountType} in ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_delivery', 'tiered')`
    ),
    check(
      "promotions_scope_valid",
      sql`${table.scope} in ('cart', 'product', 'category', 'delivery')`
    ),
    check(
      "promotions_kind_type_scope_valid",
      sql`(${table.kind} = 'coupon'
          and ${table.discountType} in ('percentage', 'fixed_amount', 'tiered')
          and ${table.scope} = 'cart')
        or (${table.kind} = 'offer' and (
          (${table.discountType} in ('percentage', 'fixed_amount')
            and ${table.scope} in ('cart', 'product', 'category'))
          or (${table.discountType} = 'buy_x_get_y'
            and ${table.scope} in ('product', 'category'))
          or (${table.discountType} = 'free_delivery' and ${table.scope} = 'delivery')
          or (${table.discountType} = 'tiered' and ${table.scope} = 'cart')
        ))`
    ),
    check(
      "promotions_discount_value_matches_type",
      sql`(${table.discountType} = 'percentage'
          and ${table.discountRateBps} between 1 and 10000
          and ${table.discountAmountPaise} is null)
        or (${table.discountType} = 'fixed_amount'
          and ${table.discountRateBps} is null
          and ${table.discountAmountPaise} > 0)
        or (${table.discountType} in ('buy_x_get_y', 'free_delivery', 'tiered')
          and ${table.discountRateBps} is null
          and ${table.discountAmountPaise} is null)`
    ),
    check(
      "promotions_max_discount_valid",
      sql`(${table.discountType} = 'percentage'
          and (${table.maxDiscountPaise} is null or ${table.maxDiscountPaise} > 0))
        or (${table.discountType} <> 'percentage' and ${table.maxDiscountPaise} is null)`
    ),
    check(
      "promotions_customization_value_valid",
      sql`${table.includeCustomizationValue} = false
        or ${table.discountType} in ('percentage', 'fixed_amount', 'tiered')`
    ),
    check(
      "promotions_eligibility_amounts_valid",
      sql`${table.minimumOrderPaise} >= 0 and ${table.minimumCartQuantity} >= 0`
    ),
    check(
      "promotions_limits_valid",
      sql`(${table.perUserRedemptionLimit} is null or ${table.perUserRedemptionLimit} > 0)
        and (${table.maxRedemptions} is null or ${table.maxRedemptions} > 0)
        and (${table.totalDiscountBudgetPaise} is null or ${table.totalDiscountBudgetPaise} > 0)`
    ),
    check(
      "promotions_definition_version_positive",
      sql`${table.definitionVersion} > 0`
    ),
    check(
      "promotions_validity_range_valid",
      sql`${table.endsAt} > ${table.startsAt}`
    ),
    check(
      "promotions_time_window_valid",
      sql`(${table.activeStartTime} is null and ${table.activeEndTime} is null)
        or (${table.activeStartTime} is not null
          and ${table.activeEndTime} is not null
          and ${table.activeStartTime} <> ${table.activeEndTime})`
    ),
    check(
      "promotions_active_days_valid",
      sql`${table.activeDaysOfWeek} is null or (
        cardinality(${table.activeDaysOfWeek}) between 1 and 7
        and ${table.activeDaysOfWeek} <@ array[0, 1, 2, 3, 4, 5, 6]::integer[]
      )`
    ),
    check(
      "promotions_display_priority_nonnegative",
      sql`${table.displayPriority} >= 0`
    ),
    check(
      "promotions_media_consistency",
      sql`(${table.imageUrl} is null and ${table.mobileImageUrl} is null and ${table.imageAlt} is null)
        or ((${table.imageUrl} is not null or ${table.mobileImageUrl} is not null)
          and nullif(btrim(${table.imageAlt}), '') is not null
          and char_length(${table.imageAlt}) <= 200
          and (${table.imageUrl} is null or (
            ${table.imageUrl} = btrim(${table.imageUrl})
            and ${table.imageUrl} like '/%'
            and ${table.imageUrl} not like '%..%'
            and position(chr(92) in ${table.imageUrl}) = 0
          ))
          and (${table.mobileImageUrl} is null or (
            ${table.mobileImageUrl} = btrim(${table.mobileImageUrl})
            and ${table.mobileImageUrl} like '/%'
            and ${table.mobileImageUrl} not like '%..%'
            and position(chr(92) in ${table.mobileImageUrl}) = 0
          )))`
    ),
    check(
      "promotions_homepage_placement_valid",
      sql`${table.showOnHomepage} = false or (
        ${table.kind} = 'offer'
        and nullif(btrim(${table.imageUrl}), '') is not null
        and nullif(btrim(${table.imageAlt}), '') is not null
      )`
    ),
  ]
);
