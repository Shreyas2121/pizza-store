import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { CouponType } from "../../utils/types";

// ──────────────────────────────────────────────
// Coupons
// ──────────────────────────────────────────────

export const couponsTable = pgTable("coupons", {
  id,
  code: text().notNull().unique(),
  discountType: text("discount_type").$type<CouponType>().notNull(),
  discountRateBps: integer("discount_rate_bps"),
  discountAmountPaise: integer("discount_amount_paise"),
  minimumOrderPaise: integer("minimum_order_paise").default(0).notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive,
  redemptionCount: integer("redemption_count").default(0).notNull(),
  maxRedemptions: integer("max_redemptions").default(-1).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  check("coupons_minimum_order_paise_nonnegative", sql`${table.minimumOrderPaise} >= 0`),
  check("coupons_discount_rate_bps_valid", sql`${table.discountRateBps} is null or (${table.discountRateBps} > 0 and ${table.discountRateBps} <= 10000)`),
  check("coupons_discount_amount_paise_positive", sql`${table.discountAmountPaise} is null or ${table.discountAmountPaise} > 0`),
  check("coupons_discount_value_matches_type", sql`(${table.discountType} = 'percentage' and ${table.discountRateBps} is not null and ${table.discountAmountPaise} is null) or (${table.discountType} = 'fixed' and ${table.discountAmountPaise} is not null and ${table.discountRateBps} is null)`),
]);
