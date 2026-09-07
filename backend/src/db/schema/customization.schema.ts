import {
  boolean,
  check,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt } from "./_helpers";
import { CustomizationType } from "../../utils/types";
import { productsTable } from "./catalog.schema";

// ──────────────────────────────────────────────
// Customization Groups
// ──────────────────────────────────────────────

export const customizationGroupsTable = pgTable("customization_groups", {
  id,
  name: text().notNull(),
  type: text().$type<CustomizationType>().notNull(),
  required: boolean("required").default(false).notNull(),
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Customization Options
// ──────────────────────────────────────────────

export const customizationOptionsTable = pgTable("customization_options", {
  id,
  groupId: integer("group_id")
    .references(() => customizationGroupsTable.id)
    .notNull(),
  name: text().notNull(),
  pricePaise: integer("price_paise").default(0).notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt,
  updatedAt,
}, (table) => [
  check("customization_options_price_paise_nonnegative", sql`${table.pricePaise} >= 0`),
]);

// ──────────────────────────────────────────────
// Product ↔ Customization Group Mapping
// ──────────────────────────────────────────────

export const productCustomizationGroupMappingTable = pgTable(
  "product_customization_group_mapping",
  {
    productId: integer("product_id")
      .references(() => productsTable.id)
      .notNull(),
    groupId: integer("group_id")
      .references(() => customizationGroupsTable.id)
      .notNull(),
  }
);
