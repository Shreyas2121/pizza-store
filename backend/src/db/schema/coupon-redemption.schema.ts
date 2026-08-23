import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import type { CouponRedemptionStatus } from "../../utils/types";
import { couponsTable } from "./coupon.schema";
import { ordersTable } from "./order.schema";
import { usersTable } from "./user.schema";

export const couponRedemptionsTable = pgTable(
  "coupon_redemptions",
  {
    id,
    couponId: integer("coupon_id")
      .references(() => couponsTable.id)
      .notNull(),
    orderId: integer("order_id")
      .references(() => ordersTable.id)
      .notNull()
      .unique(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    status: text()
      .$type<CouponRedemptionStatus>()
      .default("reserved")
      .notNull(),
    reservedAt: timestamp("reserved_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("coupon_redemptions_coupon_status_idx").on(
      table.couponId,
      table.status
    ),
    index("coupon_redemptions_user_idx").on(table.userId),
    check(
      "coupon_redemptions_status_valid",
      sql`${table.status} in ('reserved', 'consumed', 'released')`
    ),
  ]
);
