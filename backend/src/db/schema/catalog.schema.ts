import {
  boolean,
  check,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt, isActive } from "./_helpers";

// ──────────────────────────────────────────────
// Categories
// ──────────────────────────────────────────────

export const categoriesTable = pgTable("categories", {
  id,
  name: text().unique().notNull(),
  featured: boolean("featured").default(false),
  isActive,
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Products
// ──────────────────────────────────────────────

export const productsTable = pgTable("products", {
  id,
  name: text().notNull(),
  description: text(),
  slug: text().unique().notNull(),
  veg: boolean("veg").default(false),
  hasCustomization: boolean("has_customization").default(false).notNull(),
  pricePaise: integer("price_paise").notNull(),
  image: text().notNull(),
  productType: text("product_type")
    .$type<"single" | "bundle">()
    .default("single")
    .notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  categoryId: integer("category_id")
    .references(() => categoriesTable.id)
    .notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  check("products_price_paise_nonnegative", sql`${table.pricePaise} >= 0`),
  check(
    "products_product_type_valid",
    sql`${table.productType} in ('single', 'bundle')`
  ),
]);
