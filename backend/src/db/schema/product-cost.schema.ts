import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_helpers";
import { storeProductsTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const productCostVersionsTable = pgTable("product_cost_versions", {
  id,
  storeProductId: integer("store_product_id").notNull(),
  storeId: integer("store_id").notNull(),
  unitCostPaise: integer("unit_cost_paise").notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  source: text().notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt,
}, (table) => [
  foreignKey({
    columns: [table.storeProductId, table.storeId],
    foreignColumns: [storeProductsTable.id, storeProductsTable.storeId],
    name: "product_cost_versions_store_product_store_fk",
  }),
  unique("product_cost_versions_id_store_unique").on(table.id, table.storeId),
  unique("product_cost_versions_store_product_from_unique").on(table.storeProductId, table.effectiveFrom),
  index("product_cost_versions_store_product_effective_idx").on(
    table.storeProductId, table.effectiveFrom, table.effectiveTo
  ),
  check("product_cost_versions_amount_nonnegative", sql`${table.unitCostPaise} >= 0`),
  check("product_cost_versions_source_present", sql`nullif(btrim(${table.source}), '') is not null and char_length(${table.source}) <= 255`),
  check("product_cost_versions_range_valid", sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`),
]);

export type ProductCostVersion = typeof productCostVersionsTable.$inferSelect;
