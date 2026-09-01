import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import { OrderStatus, PaymentCurrency, PaymentType } from "../../utils/types";
import { usersTable, addressTable } from "./user.schema";
import { productsTable } from "./catalog.schema";
import { paymentsTable } from "./payment.schema";
import { couponsTable } from "./coupon.schema";
import { customizationOptionsTable } from "./customization.schema";
import { deliveryPricingRulesTable, storesTable } from "./store.schema";

export const ordersTable = pgTable(
  "orders",
  {
    id,
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    orderDate: timestamp("order_date", { withTimezone: true }).defaultNow(),
    couponId: integer("coupon_id").references(() => couponsTable.id),
    itemsSubtotalPaise: integer("items_subtotal_paise").notNull(),
    discountPaise: integer("discount_paise").notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull(),
    taxableAmountPaise: integer("taxable_amount_paise").notNull(),
    taxPaise: integer("tax_paise").notNull(),
    roundingAdjustmentPaise: integer("rounding_adjustment_paise").notNull(),
    grandTotalPaise: integer("grand_total_paise").notNull(),
    currency: text().$type<PaymentCurrency>().notNull(),
    quoteVersion: text("quote_version").notNull(),
    pricingPolicyVersion: integer("pricing_policy_version").notNull(),
    deliveryPricingRuleId: integer("delivery_pricing_rule_id")
      .references(() => deliveryPricingRulesTable.id)
      .notNull(),
    deliveryPricingRuleVersion: integer("delivery_pricing_rule_version").notNull(),
    pricingBusinessDate: text("pricing_business_date").notNull(),
    pricingTimezone: text("pricing_timezone").notNull(),
    recognizedAt: timestamp("recognized_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    status: text().$type<OrderStatus>().default("pending").notNull(),
    paymentType: text("payment_type").$type<PaymentType>().default("cash").notNull(),
    paymentId: integer("payment_id").references(() => paymentsTable.id).unique(),
    addressId: integer("address_id").references(() => addressTable.id),
    storeId: integer("store_id").references(() => storesTable.id).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    check(
      "orders_exact_amounts_nonnegative",
      sql`${table.itemsSubtotalPaise} >= 0
        and ${table.discountPaise} >= 0
        and ${table.deliveryFeePaise} >= 0
        and ${table.taxableAmountPaise} >= 0
        and ${table.taxPaise} >= 0
        and ${table.grandTotalPaise} >= 0`
    ),
    check(
      "orders_discount_within_subtotal",
      sql`${table.discountPaise} <= ${table.itemsSubtotalPaise}`
    ),
    check(
      "orders_grand_total_reconciles",
      sql`${table.grandTotalPaise}::bigint =
        ${table.itemsSubtotalPaise}::bigint - ${table.discountPaise}::bigint
        + ${table.deliveryFeePaise}::bigint + ${table.roundingAdjustmentPaise}::bigint`
    ),
    check(
      "orders_inclusive_tax_reconciles",
      sql`${table.taxableAmountPaise}::bigint + ${table.taxPaise}::bigint =
        ${table.itemsSubtotalPaise}::bigint - ${table.discountPaise}::bigint
        + ${table.deliveryFeePaise}::bigint`
    ),
    check("orders_currency_inr", sql`${table.currency} = 'INR'`),
    check(
      "orders_quote_version_present",
      sql`nullif(btrim(${table.quoteVersion}), '') is not null`
    ),
    check(
      "orders_pricing_policy_version_positive",
      sql`${table.pricingPolicyVersion} > 0`
    ),
    check(
      "orders_delivery_pricing_rule_version_positive",
      sql`${table.deliveryPricingRuleVersion} > 0`
    ),
    check(
      "orders_pricing_business_date_valid",
      sql`${table.pricingBusinessDate} ~ '^\\d{4}-\\d{2}-\\d{2}$'`
    ),
    check(
      "orders_pricing_timezone_present",
      sql`nullif(btrim(${table.pricingTimezone}), '') is not null`
    ),
  ]
);

export const orderItemsTable = pgTable(
  "order_items",
  {
    id,
    orderId: integer("order_id").references(() => ordersTable.id).notNull(),
    productId: integer("product_id").references(() => productsTable.id).notNull(),
    quantity: integer().default(1).notNull(),
    productName: text("product_name").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    lineSubtotalPaise: integer("line_subtotal_paise").notNull(),
    discountAllocationPaise: integer("discount_allocation_paise").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    taxableAmountPaise: integer("taxable_amount_paise").notNull(),
    taxPaise: integer("tax_paise").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(),
    unitCostPaise: integer("unit_cost_paise"),
    lineCostPaise: integer("line_cost_paise"),
    hsnSacCode: text("hsn_sac_code"),
    createdAt,
    updatedAt,
  },
  (table) => [
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_items_snapshot_name_present",
      sql`nullif(btrim(${table.productName}), '') is not null`
    ),
    check(
      "order_items_price_amounts_nonnegative",
      sql`${table.unitPricePaise} >= 0
        and ${table.lineSubtotalPaise} >= 0
        and ${table.discountAllocationPaise} >= 0
        and ${table.taxableAmountPaise} >= 0
        and ${table.taxPaise} >= 0
        and ${table.lineTotalPaise} >= 0`
    ),
    check(
      "order_items_tax_rate_valid",
      sql`${table.taxRateBps} between 0 and 10000`
    ),
    check(
      "order_items_subtotal_reconciles",
      sql`${table.lineSubtotalPaise}::bigint =
        ${table.unitPricePaise}::bigint * ${table.quantity}::bigint`
    ),
    check(
      "order_items_discount_within_subtotal",
      sql`${table.discountAllocationPaise} <= ${table.lineSubtotalPaise}`
    ),
    check(
      "order_items_line_total_reconciles",
      sql`${table.lineTotalPaise}::bigint =
        ${table.lineSubtotalPaise}::bigint - ${table.discountAllocationPaise}::bigint`
    ),
    check(
      "order_items_inclusive_tax_reconciles",
      sql`${table.taxableAmountPaise}::bigint + ${table.taxPaise}::bigint = ${table.lineTotalPaise}::bigint`
    ),
    check(
      "order_items_cost_snapshot_complete",
      sql`(${table.unitCostPaise} is null and ${table.lineCostPaise} is null)
        or (${table.unitCostPaise} is not null and ${table.lineCostPaise} is not null)`
    ),
    check(
      "order_items_cost_amounts_valid",
      sql`${table.unitCostPaise} is null or (
        ${table.unitCostPaise} >= 0
        and ${table.lineCostPaise}::bigint = ${table.unitCostPaise}::bigint * ${table.quantity}::bigint
      )`
    ),
    check(
      "order_items_hsn_sac_code_present",
      sql`${table.hsnSacCode} is null or nullif(btrim(${table.hsnSacCode}), '') is not null`
    ),
  ]
);

export const orderItemCustomizationsTable = pgTable(
  "order_item_customizations",
  {
    id,
    orderItemId: integer("order_item_id").references(() => orderItemsTable.id).notNull(),
    customizationOptionId: integer("customization_option_id")
      .references(() => customizationOptionsTable.id)
      .notNull(),
    customizationName: text("customization_name").notNull(),
    pricePaise: integer("price_paise").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    check(
      "order_item_customizations_name_present",
      sql`nullif(btrim(${table.customizationName}), '') is not null`
    ),
    check(
      "order_item_customizations_price_nonnegative",
      sql`${table.pricePaise} >= 0`
    ),
  ]
);

export const orderItemRelations = {
  customizations: {
    table: orderItemCustomizationsTable,
    relation: "many",
    fields: [orderItemsTable.id],
    references: [orderItemCustomizationsTable.orderItemId],
  },
};
