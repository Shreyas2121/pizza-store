import { check, integer, pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt } from "./_helpers";
import { usersTable } from "./user.schema";
import { productsTable } from "./catalog.schema";
import { customizationOptionsTable } from "./customization.schema";
import { storesTable } from "./store.schema";

// ──────────────────────────────────────────────
// Cart
// ──────────────────────────────────────────────

export const cartTable = pgTable("cart", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  totalPaise: integer("total_paise").default(0).notNull(),
  storeId: integer("store_id").references(() => storesTable.id),
  createdAt,
  updatedAt,
}, (table) => [
  check("cart_total_paise_nonnegative", sql`${table.totalPaise} >= 0`),
]);

// ──────────────────────────────────────────────
// Cart Items
// ──────────────────────────────────────────────

export const cartItemsTable = pgTable("cart_items", {
  id,
  cartId: integer("cart_id")
    .references(() => cartTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
  quantity: integer().default(1).notNull(),
  pricePaise: integer("price_paise").default(0).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  check("cart_items_price_paise_nonnegative", sql`${table.pricePaise} >= 0`),
]);

// ──────────────────────────────────────────────
// Cart Item Customizations
// ──────────────────────────────────────────────

export const cartItemCustomizationsTable = pgTable("cart_item_customizations", {
  id,
  cartItemId: integer("cart_item_id")
    .references(() => cartItemsTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  customizationOptionId: integer("customization_option_id")
    .references(() => customizationOptionsTable.id)
    .notNull(),
  pricePaise: integer("price_paise").notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  check("cart_item_customizations_price_paise_nonnegative", sql`${table.pricePaise} >= 0`),
]);
