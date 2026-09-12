import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, unique } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { productsTable } from "./catalog.schema";

export const bundleComponentsTable = pgTable(
  "bundle_components",
  {
    id,
    bundleProductId: integer("bundle_product_id")
      .references(() => productsTable.id, { onDelete: "cascade" })
      .notNull(),
    componentProductId: integer("component_product_id")
      .references(() => productsTable.id)
      .notNull(),
    quantity: integer().notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("bundle_components_bundle_product_unique").on(
      table.bundleProductId,
      table.componentProductId
    ),
    index("bundle_components_component_product_idx").on(
      table.componentProductId,
      table.bundleProductId
    ),
    check("bundle_components_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "bundle_components_distinct_products",
      sql`${table.bundleProductId} <> ${table.componentProductId}`
    ),
  ]
);
