import {
  doublePrecision,
  integer,
  pgTable,
} from "drizzle-orm/pg-core";
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
  totalPrice: doublePrecision("total_price").default(0).notNull(),
  storeId: integer("store_id").references(() => storesTable.id),
  createdAt,
  updatedAt,
});

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
  price: doublePrecision("price").default(0).notNull(),
  createdAt,
  updatedAt,
});

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
  price: doublePrecision("price").notNull(),
  createdAt,
  updatedAt,
});
