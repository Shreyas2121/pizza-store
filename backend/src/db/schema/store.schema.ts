import {
  boolean,
  check,
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { productsTable } from "./catalog.schema";

// ──────────────────────────────────────────────
// Stores
// ──────────────────────────────────────────────

export const storesTable = pgTable("stores", {
  id,
  name: text().notNull(),
  slug: text().unique().notNull(),
  address: text().notNull(),
  city: text().notNull(),
  state: text().notNull(),
  pincode: text().notNull(),
  phone: text().notNull(),
  email: text(),
  latitude: doublePrecision(),
  longitude: doublePrecision(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
  timezone: text().notNull().default("Asia/Kolkata"),
  isActive,
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Store Products (junction table)
// ──────────────────────────────────────────────

export const storeProductsTable = pgTable(
  "store_products",
  {
    id,
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    productId: integer("product_id")
      .references(() => productsTable.id)
      .notNull(),
    pricePaise: integer("price_paise").notNull(),
    compareAtPricePaise: integer("compare_at_price_paise"),
    isAvailable: boolean("is_available").notNull().default(true),
    onHandQuantity: integer("on_hand_quantity"),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(10),
    lastRestockedAt: timestamp("last_restocked_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("store_products_id_store_id_unique").on(table.id, table.storeId),
    unique("store_products_store_id_product_id_unique").on(
      table.storeId,
      table.productId
    ),
    check(
      "store_products_on_hand_quantity_nonnegative",
      sql`${table.onHandQuantity} is null or ${table.onHandQuantity} >= 0`
    ),
    check(
      "store_products_low_stock_threshold_nonnegative",
      sql`${table.lowStockThreshold} >= 0`
    ),
    check(
      "store_products_price_paise_nonnegative",
      sql`${table.pricePaise} >= 0`
    ),
    check(
      "store_products_compare_at_price_valid",
      sql`${table.compareAtPricePaise} is null or ${table.compareAtPricePaise} > ${table.pricePaise}`
    ),
  ]
);

// ──────────────────────────────────────────────
// Delivery Zones
// ──────────────────────────────────────────────

export const deliveryZonesTable = pgTable(
  "delivery_zones",
  {
    id,
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    pincode: text().notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("delivery_zones_store_id_pincode_unique").on(
      table.storeId,
      table.pincode
    ),
  ]
);

// ──────────────────────────────────────────────
// Store-scoped delivery pricing
// ──────────────────────────────────────────────

export const deliveryPricingRulesTable = pgTable(
  "delivery_pricing_rules",
  {
    id,
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    version: integer().notNull(),
    deliveryFeePaise: integer("delivery_fee_paise").notNull(),
    freeDeliveryThresholdPaise: integer("free_delivery_threshold_paise"),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("delivery_pricing_rules_store_version_unique").on(
      table.storeId,
      table.version
    ),
    unique("delivery_pricing_rules_store_effective_from_unique").on(
      table.storeId,
      table.effectiveFrom
    ),
    check("delivery_pricing_rules_version_positive", sql`${table.version} > 0`),
    check(
      "delivery_pricing_rules_amounts_valid",
      sql`${table.deliveryFeePaise} >= 0
        and (${table.freeDeliveryThresholdPaise} is null or ${table.freeDeliveryThresholdPaise} > 0)`
    ),
    check(
      "delivery_pricing_rules_effective_range_valid",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`
    ),
  ]
);
