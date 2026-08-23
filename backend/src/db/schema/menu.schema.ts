import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { productsTable } from "./catalog.schema";

// ──────────────────────────────────────────────
// Menu Items
// ──────────────────────────────────────────────

export const menuItemsTable = pgTable("menu_items", {
  id,
  name: text().notNull(),
  position: integer().unique().notNull(),
  image: text().notNull(),
  slug: text().unique().notNull(),
  isActive,
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Menu Items ↔ Product Mapping
// ──────────────────────────────────────────────

export const menuItemsMappingTable = pgTable("menu_items_mapping", {
  menuItemId: integer("menu_item_id")
    .references(() => menuItemsTable.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
});
