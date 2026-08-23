import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  real,
  text,
  unique,
} from "drizzle-orm/pg-core";
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
    price: real().notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("store_products_store_id_product_id_unique").on(
      table.storeId,
      table.productId
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
// Delivery Price
// ──────────────────────────────────────────────

export const deliveryPrice = pgTable("delivery_price", {
  id,
  deliveryCharge: doublePrecision("delivery_charge").notNull(),
  minOrder: doublePrecision("min_order").default(0).notNull(),
  createdAt,
  updatedAt,
});
