import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, pgTable, text, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export type EmploymentStatus = "active" | "on_leave" | "terminated";
export type PayFrequency = "monthly";
export type CompensationComponentType = "earning" | "deduction" | "employer_cost";

export const employeeFinanceProfilesTable = pgTable("employee_finance_profiles", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  employeeCode: text("employee_code").notNull(),
  displayName: text("display_name").notNull(),
  employmentStartDate: date("employment_start_date", { mode: "string" }).notNull(),
  employmentEndDate: date("employment_end_date", { mode: "string" }),
  status: text().$type<EmploymentStatus>().default("active").notNull(),
  payFrequency: text("pay_frequency").$type<PayFrequency>().default("monthly").notNull(),
  bankAccountEncrypted: text("bank_account_encrypted"),
  bankAccountLast4: text("bank_account_last4"),
  taxIdentifierEncrypted: text("tax_identifier_encrypted"),
  taxIdentifierLast4: text("tax_identifier_last4"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedBy: integer("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}, (table) => [
  unique("employee_finance_profiles_id_store_unique").on(table.id, table.storeId),
  unique("employee_finance_profiles_store_code_unique").on(table.storeId, table.employeeCode),
  uniqueIndex("employee_finance_profiles_store_user_unique").on(table.storeId, table.userId)
    .where(sql`${table.userId} is not null`),
  index("employee_finance_profiles_store_status_idx").on(table.storeId, table.status, table.displayName),
  check("employee_finance_profiles_code_present", sql`nullif(btrim(${table.employeeCode}), '') is not null and char_length(${table.employeeCode}) <= 40`),
  check("employee_finance_profiles_name_present", sql`nullif(btrim(${table.displayName}), '') is not null and char_length(${table.displayName}) <= 160`),
  check("employee_finance_profiles_dates_valid", sql`${table.employmentEndDate} is null or ${table.employmentEndDate} >= ${table.employmentStartDate}`),
  check("employee_finance_profiles_status_valid", sql`${table.status} in ('active', 'on_leave', 'terminated')`),
  check("employee_finance_profiles_terminated_date", sql`${table.status} <> 'terminated' or ${table.employmentEndDate} is not null`),
  check("employee_finance_profiles_frequency_valid", sql`${table.payFrequency} = 'monthly'`),
  check("employee_finance_profiles_bank_pair", sql`(${table.bankAccountEncrypted} is null) = (${table.bankAccountLast4} is null)`),
  check("employee_finance_profiles_tax_pair", sql`(${table.taxIdentifierEncrypted} is null) = (${table.taxIdentifierLast4} is null)`),
  check("employee_finance_profiles_bank_last4", sql`${table.bankAccountLast4} is null or ${table.bankAccountLast4} ~ '^[A-Za-z0-9]{4}$'`),
  check("employee_finance_profiles_tax_last4", sql`${table.taxIdentifierLast4} is null or ${table.taxIdentifierLast4} ~ '^[A-Za-z0-9]{4}$'`),
]);

export const compensationVersionsTable = pgTable("compensation_versions", {
  id,
  profileId: integer("profile_id").notNull(),
  storeId: integer("store_id").notNull(),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  currency: text().$type<"INR">().default("INR").notNull(),
  sourceNote: text("source_note"),
  demoOnly: boolean("demo_only").default(true).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt,
}, (table) => [
  foreignKey({
    columns: [table.profileId, table.storeId],
    foreignColumns: [employeeFinanceProfilesTable.id, employeeFinanceProfilesTable.storeId],
    name: "compensation_versions_profile_store_fk",
  }).onDelete("cascade"),
  unique("compensation_versions_profile_from_unique").on(table.profileId, table.effectiveFrom),
  index("compensation_versions_profile_effective_idx").on(table.profileId, table.effectiveFrom, table.effectiveTo),
  check("compensation_versions_range_valid", sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`),
  check("compensation_versions_currency_inr", sql`${table.currency} = 'INR'`),
  check("compensation_versions_demo_only", sql`${table.demoOnly} = true`),
  check("compensation_versions_source_note_length", sql`${table.sourceNote} is null or char_length(${table.sourceNote}) <= 500`),
]);

export const compensationComponentsTable = pgTable("compensation_components", {
  id,
  compensationVersionId: integer("compensation_version_id")
    .references(() => compensationVersionsTable.id, { onDelete: "cascade" }).notNull(),
  type: text().$type<CompensationComponentType>().notNull(),
  code: text().notNull(),
  name: text().notNull(),
  amountPaise: integer("amount_paise").notNull(),
  createdAt,
}, (table) => [
  unique("compensation_components_version_type_code_unique").on(table.compensationVersionId, table.type, table.code),
  index("compensation_components_version_idx").on(table.compensationVersionId, table.type, table.id),
  check("compensation_components_type_valid", sql`${table.type} in ('earning', 'deduction', 'employer_cost')`),
  check("compensation_components_code_valid", sql`${table.code} ~ '^[A-Z][A-Z0-9_]{1,39}$'`),
  check("compensation_components_name_present", sql`nullif(btrim(${table.name}), '') is not null and char_length(${table.name}) <= 120`),
  check("compensation_components_amount_positive", sql`${table.amountPaise} > 0 and ${table.amountPaise} <= 100000000`),
]);

export type EmployeeFinanceProfile = typeof employeeFinanceProfilesTable.$inferSelect;
export type CompensationVersion = typeof compensationVersionsTable.$inferSelect;
export type CompensationComponent = typeof compensationComponentsTable.$inferSelect;
