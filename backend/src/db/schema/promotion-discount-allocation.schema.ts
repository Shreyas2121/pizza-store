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
import { orderItemsTable } from "./order.schema";
import { promotionApplicationsTable } from "./promotion-application.schema";

export const promotionDiscountAllocationsTable = pgTable(
  "promotion_discount_allocations",
  {
    id,
    promotionApplicationId: integer("promotion_application_id")
      .references(() => promotionApplicationsTable.id, { onDelete: "cascade" })
      .notNull(),
    orderItemId: integer("order_item_id").references(() => orderItemsTable.id),
    component: text().$type<"item" | "delivery">().notNull(),
    unitIndex: integer("unit_index"),
    amountPaise: integer("amount_paise").notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("promotion_discount_allocations_item_unit_unique")
      .on(table.promotionApplicationId, table.orderItemId, table.unitIndex)
      .where(sql`${table.component} = 'item'`),
    uniqueIndex("promotion_discount_allocations_delivery_unique")
      .on(table.promotionApplicationId)
      .where(sql`${table.component} = 'delivery'`),
    index("promotion_discount_allocations_order_item_idx").on(
      table.orderItemId,
      table.promotionApplicationId
    ),
    check(
      "promotion_discount_allocations_shape_valid",
      sql`(${table.component} = 'item'
          and ${table.orderItemId} is not null
          and ${table.unitIndex} >= 0)
        or (${table.component} = 'delivery'
          and ${table.orderItemId} is null
          and ${table.unitIndex} is null)`
    ),
    check(
      "promotion_discount_allocations_amount_positive",
      sql`${table.amountPaise} > 0`
    ),
  ]
);
