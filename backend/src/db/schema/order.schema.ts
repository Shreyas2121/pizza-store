import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
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
import { storesTable } from "./store.schema";

// Exact snapshot fields remain nullable until P1.4 cuts order writes over to them.
export const ordersTable = pgTable(
  "orders",
  {
    id,
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    orderDate: timestamp("order_date", { withTimezone: true }).defaultNow(),
    discountAmount: doublePrecision("discount_amount").notNull(),
    couponId: integer("coupon_id").references(() => couponsTable.id),
    totalPrice: doublePrecision("total_price").default(0).notNull(),
    itemsSubtotalPaise: integer("items_subtotal_paise"),
    discountPaise: integer("discount_paise"),
    deliveryFeePaise: integer("delivery_fee_paise"),
    taxableAmountPaise: integer("taxable_amount_paise"),
    taxPaise: integer("tax_paise"),
    roundingAdjustmentPaise: integer("rounding_adjustment_paise"),
    grandTotalPaise: integer("grand_total_paise"),
    currency: text().$type<PaymentCurrency>(),
    quoteVersion: text("quote_version"),
    pricingPolicyVersion: integer("pricing_policy_version"),
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
      "orders_exact_snapshot_complete",
      sql`(
        ${table.itemsSubtotalPaise} is null
        and ${table.discountPaise} is null
        and ${table.deliveryFeePaise} is null
        and ${table.taxableAmountPaise} is null
        and ${table.taxPaise} is null
        and ${table.roundingAdjustmentPaise} is null
        and ${table.grandTotalPaise} is null
        and ${table.currency} is null
        and ${table.quoteVersion} is null
        and ${table.pricingPolicyVersion} is null
      ) or (
        ${table.itemsSubtotalPaise} is not null
        and ${table.discountPaise} is not null
        and ${table.deliveryFeePaise} is not null
        and ${table.taxableAmountPaise} is not null
        and ${table.taxPaise} is not null
        and ${table.roundingAdjustmentPaise} is not null
        and ${table.grandTotalPaise} is not null
        and ${table.currency} is not null
        and ${table.quoteVersion} is not null
        and ${table.pricingPolicyVersion} is not null
      )`
    ),
    check(
      "orders_exact_amounts_nonnegative",
      sql`${table.itemsSubtotalPaise} is null or (
        ${table.itemsSubtotalPaise} >= 0
        and ${table.discountPaise} >= 0
        and ${table.deliveryFeePaise} >= 0
        and ${table.taxableAmountPaise} >= 0
        and ${table.taxPaise} >= 0
        and ${table.grandTotalPaise} >= 0
      )`
    ),
    check(
      "orders_discount_within_subtotal",
      sql`${table.itemsSubtotalPaise} is null or ${table.discountPaise} <= ${table.itemsSubtotalPaise}`
    ),
    check(
      "orders_grand_total_reconciles",
      sql`${table.itemsSubtotalPaise} is null or ${table.grandTotalPaise}::bigint =
        ${table.itemsSubtotalPaise}::bigint - ${table.discountPaise}::bigint
        + ${table.deliveryFeePaise}::bigint + ${table.roundingAdjustmentPaise}::bigint`
    ),
    check(
      "orders_inclusive_tax_reconciles",
      sql`${table.itemsSubtotalPaise} is null or
        ${table.taxableAmountPaise}::bigint + ${table.taxPaise}::bigint =
        ${table.itemsSubtotalPaise}::bigint - ${table.discountPaise}::bigint
        + ${table.deliveryFeePaise}::bigint`
    ),
    check("orders_currency_inr", sql`${table.currency} is null or ${table.currency} = 'INR'`),
    check(
      "orders_quote_version_present",
      sql`${table.quoteVersion} is null or nullif(btrim(${table.quoteVersion}), '') is not null`
    ),
    check(
      "orders_pricing_policy_version_positive",
      sql`${table.pricingPolicyVersion} is null or ${table.pricingPolicyVersion} > 0`
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
    price: doublePrecision("price").default(0).notNull(),
    productName: text("product_name"),
    unitPricePaise: integer("unit_price_paise"),
    lineSubtotalPaise: integer("line_subtotal_paise"),
    discountAllocationPaise: integer("discount_allocation_paise"),
    taxRateBps: integer("tax_rate_bps"),
    taxableAmountPaise: integer("taxable_amount_paise"),
    taxPaise: integer("tax_paise"),
    lineTotalPaise: integer("line_total_paise"),
    unitCostPaise: integer("unit_cost_paise"),
    lineCostPaise: integer("line_cost_paise"),
    hsnSacCode: text("hsn_sac_code"),
    createdAt,
    updatedAt,
  },
  (table) => [
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_items_price_snapshot_complete",
      sql`(
        ${table.productName} is null
        and ${table.unitPricePaise} is null
        and ${table.lineSubtotalPaise} is null
        and ${table.discountAllocationPaise} is null
        and ${table.taxRateBps} is null
        and ${table.taxableAmountPaise} is null
        and ${table.taxPaise} is null
        and ${table.lineTotalPaise} is null
      ) or (
        ${table.productName} is not null
        and ${table.unitPricePaise} is not null
        and ${table.lineSubtotalPaise} is not null
        and ${table.discountAllocationPaise} is not null
        and ${table.taxRateBps} is not null
        and ${table.taxableAmountPaise} is not null
        and ${table.taxPaise} is not null
        and ${table.lineTotalPaise} is not null
      )`
    ),
    check(
      "order_items_snapshot_name_present",
      sql`${table.productName} is null or nullif(btrim(${table.productName}), '') is not null`
    ),
    check(
      "order_items_price_amounts_nonnegative",
      sql`${table.unitPricePaise} is null or (
        ${table.unitPricePaise} >= 0
        and ${table.lineSubtotalPaise} >= 0
        and ${table.discountAllocationPaise} >= 0
        and ${table.taxableAmountPaise} >= 0
        and ${table.taxPaise} >= 0
        and ${table.lineTotalPaise} >= 0
      )`
    ),
    check(
      "order_items_tax_rate_valid",
      sql`${table.taxRateBps} is null or ${table.taxRateBps} between 0 and 10000`
    ),
    check(
      "order_items_subtotal_reconciles",
      sql`${table.unitPricePaise} is null or ${table.lineSubtotalPaise}::bigint =
        ${table.unitPricePaise}::bigint * ${table.quantity}::bigint`
    ),
    check(
      "order_items_discount_within_subtotal",
      sql`${table.unitPricePaise} is null or ${table.discountAllocationPaise} <= ${table.lineSubtotalPaise}`
    ),
    check(
      "order_items_line_total_reconciles",
      sql`${table.unitPricePaise} is null or ${table.lineTotalPaise}::bigint =
        ${table.lineSubtotalPaise}::bigint - ${table.discountAllocationPaise}::bigint`
    ),
    check(
      "order_items_inclusive_tax_reconciles",
      sql`${table.unitPricePaise} is null or
        ${table.taxableAmountPaise}::bigint + ${table.taxPaise}::bigint = ${table.lineTotalPaise}::bigint`
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
    price: doublePrecision("price").notNull(),
    customizationName: text("customization_name"),
    pricePaise: integer("price_paise"),
    createdAt,
    updatedAt,
  },
  (table) => [
    check(
      "order_item_customizations_snapshot_complete",
      sql`(${table.customizationName} is null and ${table.pricePaise} is null)
        or (${table.customizationName} is not null and ${table.pricePaise} is not null)`
    ),
    check(
      "order_item_customizations_name_present",
      sql`${table.customizationName} is null or nullif(btrim(${table.customizationName}), '') is not null`
    ),
    check(
      "order_item_customizations_price_nonnegative",
      sql`${table.pricePaise} is null or ${table.pricePaise} >= 0`
    ),
  ]
);
