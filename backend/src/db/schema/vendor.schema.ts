import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, isActive, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";
import { ledgerAccountsTable } from "./ledger.schema";

export const vendorsTable = pgTable("vendors", {
  id,
  storeId: integer("store_id").references(() => storesTable.id),
  name: text().notNull(),
  normalizedName: text("normalized_name").notNull(),
  taxRegistrationNumber: text("tax_registration_number"),
  contactName: text("contact_name"),
  email: text(),
  phone: text(),
  address: text(),
  paymentTermsDays: integer("payment_terms_days").default(0).notNull(),
  isActive,
  createdBy: integer("created_by").references(() => usersTable.id).notNull(),
  updatedBy: integer("updated_by").references(() => usersTable.id).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  uniqueIndex("vendors_store_normalized_name_unique").on(table.storeId, table.normalizedName)
    .where(sql`${table.storeId} is not null`),
  uniqueIndex("vendors_platform_normalized_name_unique").on(table.normalizedName)
    .where(sql`${table.storeId} is null`),
  index("vendors_store_active_name_idx").on(table.storeId, table.isActive, table.normalizedName),
  check("vendors_name_present", sql`nullif(btrim(${table.name}), '') is not null and char_length(${table.name}) <= 200`),
  check("vendors_normalized_name_present", sql`nullif(btrim(${table.normalizedName}), '') is not null and char_length(${table.normalizedName}) <= 200`),
  check("vendors_payment_terms_valid", sql`${table.paymentTermsDays} between 0 and 3650`),
]);

export const expenseCategoriesTable = pgTable("expense_categories", {
  id,
  storeId: integer("store_id").references(() => storesTable.id),
  parentId: integer("parent_id"),
  name: text().notNull(),
  normalizedName: text("normalized_name").notNull(),
  classification: text().$type<"fixed" | "variable">().notNull(),
  ledgerAccountId: integer("ledger_account_id").references(() => ledgerAccountsTable.id),
  isActive,
  createdBy: integer("created_by").references(() => usersTable.id).notNull(),
  updatedBy: integer("updated_by").references(() => usersTable.id).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  foreignKey({ columns: [table.parentId], foreignColumns: [table.id], name: "expense_categories_parent_fk" }),
  uniqueIndex("expense_categories_store_parent_name_unique")
    .on(table.storeId, table.parentId, table.normalizedName)
    .where(sql`${table.storeId} is not null and ${table.parentId} is not null`),
  uniqueIndex("expense_categories_store_root_name_unique")
    .on(table.storeId, table.normalizedName)
    .where(sql`${table.storeId} is not null and ${table.parentId} is null`),
  uniqueIndex("expense_categories_platform_parent_name_unique")
    .on(table.parentId, table.normalizedName)
    .where(sql`${table.storeId} is null and ${table.parentId} is not null`),
  uniqueIndex("expense_categories_platform_root_name_unique")
    .on(table.normalizedName)
    .where(sql`${table.storeId} is null and ${table.parentId} is null`),
  index("expense_categories_store_active_name_idx").on(table.storeId, table.isActive, table.normalizedName),
  check("expense_categories_name_present", sql`nullif(btrim(${table.name}), '') is not null and char_length(${table.name}) <= 120`),
  check("expense_categories_normalized_name_present", sql`nullif(btrim(${table.normalizedName}), '') is not null and char_length(${table.normalizedName}) <= 120`),
  check("expense_categories_classification_valid", sql`${table.classification} in ('fixed', 'variable')`),
  check("expense_categories_parent_not_self", sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`),
  check("expense_categories_ledger_account_positive", sql`${table.ledgerAccountId} is null or ${table.ledgerAccountId} > 0`),
]);

export type Vendor = typeof vendorsTable.$inferSelect;
export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect;
