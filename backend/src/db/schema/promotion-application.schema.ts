import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { ordersTable } from "./order.schema";
import {
  PromotionDiscountTypeValue,
  PromotionKindValue,
  promotionsTable,
} from "./promotion.schema";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export type PromotionApplicationStatusValue =
  | "reserved"
  | "consumed"
  | "released";

export const promotionApplicationsTable = pgTable(
  "promotion_applications",
  {
    id,
    promotionId: integer("promotion_id")
      .references(() => promotionsTable.id)
      .notNull(),
    orderId: integer("order_id")
      .references(() => ordersTable.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    promotionKind: text("promotion_kind").$type<PromotionKindValue>().notNull(),
    promotionName: text("promotion_name").notNull(),
    promotionCode: text("promotion_code"),
    discountType: text("discount_type")
      .$type<PromotionDiscountTypeValue>()
      .notNull(),
    definitionVersion: integer("definition_version").notNull(),
    status: text().$type<PromotionApplicationStatusValue>().notNull(),
    itemDiscountPaise: integer("item_discount_paise").notNull(),
    deliveryDiscountPaise: integer("delivery_discount_paise").notNull(),
    totalSavingsPaise: integer("total_savings_paise").notNull(),
    standardDeliveryFeePaise: integer("standard_delivery_fee_paise").notNull(),
    chargedDeliveryFeePaise: integer("charged_delivery_fee_paise").notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("promotion_applications_order_promotion_unique").on(
      table.orderId,
      table.promotionId
    ),
    uniqueIndex("promotion_applications_active_coupon_order_unique")
      .on(table.orderId)
      .where(
        sql`${table.promotionKind} = 'coupon' and ${table.status} in ('reserved', 'consumed')`
      ),
    index("promotion_applications_capacity_idx").on(
      table.promotionId,
      table.status,
      table.id
    ),
    index("promotion_applications_user_usage_idx").on(
      table.promotionId,
      table.userId,
      table.status,
      table.id
    ),
    index("promotion_applications_budget_usage_idx").on(
      table.promotionId,
      table.status,
      table.totalSavingsPaise
    ),
    index("promotion_applications_store_analytics_idx").on(
      table.promotionId,
      table.storeId,
      table.status,
      table.createdAt
    ),
    index("promotion_applications_order_status_idx").on(
      table.orderId,
      table.status
    ),
    check(
      "promotion_applications_snapshot_identity_valid",
      sql`${table.promotionKind} in ('offer', 'coupon')
        and nullif(btrim(${table.promotionName}), '') is not null
        and char_length(${table.promotionName}) <= 120
        and ${table.discountType} in ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_delivery', 'tiered')
        and ${table.definitionVersion} > 0
        and ((${table.promotionKind} = 'offer' and ${table.promotionCode} is null)
          or (${table.promotionKind} = 'coupon'
            and nullif(btrim(${table.promotionCode}), '') is not null
            and ${table.promotionCode} = upper(btrim(${table.promotionCode}))
            and char_length(${table.promotionCode}) <= 64
            and ${table.discountType} in ('percentage', 'fixed_amount', 'tiered')))`
    ),
    check(
      "promotion_applications_status_valid",
      sql`${table.status} in ('reserved', 'consumed', 'released')`
    ),
    check(
      "promotion_applications_status_timestamps_valid",
      sql`(${table.status} = 'reserved'
          and ${table.reservedAt} is not null
          and ${table.consumedAt} is null
          and ${table.releasedAt} is null)
        or (${table.status} = 'consumed'
          and ${table.consumedAt} is not null
          and ${table.releasedAt} is null)
        or (${table.status} = 'released'
          and ${table.reservedAt} is not null
          and ${table.consumedAt} is null
          and ${table.releasedAt} is not null)`
    ),
    check(
      "promotion_applications_amounts_valid",
      sql`${table.itemDiscountPaise} >= 0
        and ${table.deliveryDiscountPaise} >= 0
        and ${table.totalSavingsPaise}::bigint =
          ${table.itemDiscountPaise}::bigint + ${table.deliveryDiscountPaise}::bigint
        and ${table.totalSavingsPaise} > 0
        and ${table.standardDeliveryFeePaise} >= 0
        and ${table.chargedDeliveryFeePaise} >= 0
        and ${table.chargedDeliveryFeePaise} <= ${table.standardDeliveryFeePaise}
        and ${table.deliveryDiscountPaise} <= ${table.standardDeliveryFeePaise}
        and (${table.deliveryDiscountPaise} = 0
          or ${table.chargedDeliveryFeePaise}::bigint + ${table.deliveryDiscountPaise}::bigint =
            ${table.standardDeliveryFeePaise}::bigint)`
    ),
  ]
);
