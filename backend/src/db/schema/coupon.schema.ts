import { doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { CouponType } from "../../utils/types";

// ──────────────────────────────────────────────
// Coupons
// ──────────────────────────────────────────────

export const couponsTable = pgTable("coupons", {
  id,
  code: text().notNull().unique(),
  discountType: text("discount_type").$type<CouponType>().notNull(),
  discountValue: doublePrecision("discount_value").notNull(),
  minOrderValue: doublePrecision("min_order_value").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive,
  redemptionCount: integer("redemption_count").default(0).notNull(),
  maxRedemptions: integer("max_redemptions").default(-1).notNull(),
  createdAt,
  updatedAt,
});
