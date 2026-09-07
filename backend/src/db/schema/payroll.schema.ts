import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export type EmploymentStatus = "active" | "on_leave" | "terminated";
export type PayFrequency = "monthly";
export type CompensationComponentType = "earning" | "deduction" | "employer_cost";
export type PayRunStatus = "draft" | "calculated" | "approved" | "paid" | "posted" | "voided" | "reversed";
export type PayRunCommandAction = "calculate" | "approve" | "pay" | "post" | "void" | "reverse";

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
  unique("compensation_versions_id_profile_store_unique").on(table.id, table.profileId, table.storeId),
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

export const payRunsTable = pgTable("pay_runs", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  status: text().$type<PayRunStatus>().default("draft").notNull(),
  currency: text().$type<"INR">().default("INR").notNull(),
  demoOnly: boolean("demo_only").default(true).notNull(),
  employeeCount: integer("employee_count"),
  grossPayPaise: integer("gross_pay_paise"),
  deductionPaise: integer("deduction_paise"),
  netPayPaise: integer("net_pay_paise"),
  employerCostPaise: integer("employer_cost_paise"),
  totalEmployerCostPaise: integer("total_employer_cost_paise"),
  clientRequestId: text("client_request_id").notNull(),
  payloadHash: text("payload_hash").notNull(),
  version: integer().default(1).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  calculatedBy: integer("calculated_by").references(() => usersTable.id, { onDelete: "set null" }),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidBy: integer("paid_by").references(() => usersTable.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentReference: text("payment_reference"),
  postedBy: integer("posted_by").references(() => usersTable.id, { onDelete: "set null" }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  voidedBy: integer("voided_by").references(() => usersTable.id, { onDelete: "set null" }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  reversedBy: integer("reversed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  createdAt,
  updatedAt,
}, (table) => [
  unique("pay_runs_id_store_unique").on(table.id, table.storeId),
  unique("pay_runs_store_period_unique").on(table.storeId, table.periodStart, table.periodEnd),
  unique("pay_runs_client_request_unique").on(table.clientRequestId),
  index("pay_runs_store_period_status_idx").on(table.storeId, table.periodStart, table.periodEnd, table.status),
  check("pay_runs_period_valid", sql`${table.periodStart} <= ${table.periodEnd}`),
  check("pay_runs_monthly_period", sql`${table.periodStart} = date_trunc('month', ${table.periodStart})::date and ${table.periodEnd} = (date_trunc('month', ${table.periodStart}) + interval '1 month - 1 day')::date`),
  check("pay_runs_status_valid", sql`${table.status} in ('draft', 'calculated', 'approved', 'paid', 'posted', 'voided', 'reversed')`),
  check("pay_runs_currency_inr", sql`${table.currency} = 'INR'`),
  check("pay_runs_demo_only", sql`${table.demoOnly} = true`),
  check("pay_runs_version_positive", sql`${table.version} > 0`),
  check("pay_runs_request_uuid", sql`${table.clientRequestId} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  check("pay_runs_payload_hash", sql`${table.payloadHash} ~ '^[a-f0-9]{64}$'`),
  check("pay_runs_totals_complete", sql`(${table.employeeCount} is null and ${table.grossPayPaise} is null and ${table.deductionPaise} is null and ${table.netPayPaise} is null and ${table.employerCostPaise} is null and ${table.totalEmployerCostPaise} is null) or (${table.employeeCount} > 0 and ${table.grossPayPaise} >= 0 and ${table.deductionPaise} >= 0 and ${table.netPayPaise} >= 0 and ${table.employerCostPaise} >= 0 and ${table.totalEmployerCostPaise} >= 0 and ${table.netPayPaise} = ${table.grossPayPaise} - ${table.deductionPaise} and ${table.totalEmployerCostPaise} = ${table.grossPayPaise} + ${table.employerCostPaise})`),
  check("pay_runs_calculation_evidence", sql`${table.status} in ('draft', 'voided') or (${table.calculatedBy} is not null and ${table.calculatedAt} is not null and ${table.employeeCount} is not null)`),
  check("pay_runs_approval_evidence", sql`${table.status} not in ('approved', 'paid', 'posted', 'reversed') or (${table.approvedBy} is not null and ${table.approvedAt} is not null)`),
  check("pay_runs_payment_evidence", sql`${table.status} not in ('paid', 'posted', 'reversed') or (${table.paidBy} is not null and ${table.paidAt} is not null and nullif(btrim(${table.paymentReference}), '') is not null)`),
  check("pay_runs_posting_evidence", sql`${table.status} not in ('posted', 'reversed') or (${table.postedBy} is not null and ${table.postedAt} is not null)`),
  check("pay_runs_void_evidence", sql`${table.status} <> 'voided' or (${table.voidedBy} is not null and ${table.voidedAt} is not null and nullif(btrim(${table.voidReason}), '') is not null)`),
  check("pay_runs_reversal_evidence", sql`${table.status} <> 'reversed' or (${table.reversedBy} is not null and ${table.reversedAt} is not null and nullif(btrim(${table.reversalReason}), '') is not null)`),
]);

export const payRunEmployeesTable = pgTable("pay_run_employees", {
  id,
  payRunId: integer("pay_run_id").notNull(),
  payRunStoreId: integer("pay_run_store_id").notNull(),
  profileId: integer("profile_id").notNull(),
  compensationVersionId: integer("compensation_version_id").notNull(),
  employeeCode: text("employee_code").notNull(),
  displayName: text("display_name").notNull(),
  grossPayPaise: integer("gross_pay_paise").notNull(),
  deductionPaise: integer("deduction_paise").notNull(),
  netPayPaise: integer("net_pay_paise").notNull(),
  employerCostPaise: integer("employer_cost_paise").notNull(),
  totalEmployerCostPaise: integer("total_employer_cost_paise").notNull(),
  createdAt,
}, (table) => [
  foreignKey({ columns: [table.payRunId, table.payRunStoreId], foreignColumns: [payRunsTable.id, payRunsTable.storeId], name: "pay_run_employees_run_store_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.profileId, table.payRunStoreId], foreignColumns: [employeeFinanceProfilesTable.id, employeeFinanceProfilesTable.storeId], name: "pay_run_employees_profile_store_fk" }),
  foreignKey({ columns: [table.compensationVersionId, table.profileId, table.payRunStoreId], foreignColumns: [compensationVersionsTable.id, compensationVersionsTable.profileId, compensationVersionsTable.storeId], name: "pay_run_employees_compensation_profile_store_fk" }),
  unique("pay_run_employees_run_profile_unique").on(table.payRunId, table.profileId),
  index("pay_run_employees_run_idx").on(table.payRunId, table.id),
  check("pay_run_employees_code_present", sql`nullif(btrim(${table.employeeCode}), '') is not null and char_length(${table.employeeCode}) <= 40`),
  check("pay_run_employees_name_present", sql`nullif(btrim(${table.displayName}), '') is not null and char_length(${table.displayName}) <= 160`),
  check("pay_run_employees_totals_valid", sql`${table.grossPayPaise} >= 0 and ${table.deductionPaise} >= 0 and ${table.netPayPaise} >= 0 and ${table.employerCostPaise} >= 0 and ${table.totalEmployerCostPaise} >= 0 and ${table.netPayPaise} = ${table.grossPayPaise} - ${table.deductionPaise} and ${table.totalEmployerCostPaise} = ${table.grossPayPaise} + ${table.employerCostPaise}`),
]);

export const payRunLinesTable = pgTable("pay_run_lines", {
  id,
  payRunEmployeeId: integer("pay_run_employee_id").references(() => payRunEmployeesTable.id, { onDelete: "cascade" }).notNull(),
  compensationComponentId: integer("compensation_component_id").references(() => compensationComponentsTable.id).notNull(),
  type: text().$type<CompensationComponentType>().notNull(),
  componentCode: text("component_code").notNull(),
  componentName: text("component_name").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  createdAt,
}, (table) => [
  unique("pay_run_lines_employee_type_code_unique").on(table.payRunEmployeeId, table.type, table.componentCode),
  index("pay_run_lines_employee_idx").on(table.payRunEmployeeId, table.type, table.id),
  check("pay_run_lines_type_valid", sql`${table.type} in ('earning', 'deduction', 'employer_cost')`),
  check("pay_run_lines_code_present", sql`nullif(btrim(${table.componentCode}), '') is not null and char_length(${table.componentCode}) <= 40`),
  check("pay_run_lines_name_present", sql`nullif(btrim(${table.componentName}), '') is not null and char_length(${table.componentName}) <= 120`),
  check("pay_run_lines_amount_positive", sql`${table.amountPaise} > 0 and ${table.amountPaise} <= 100000000`),
]);

export const payRunCommandsTable = pgTable("pay_run_commands", {
  id,
  payRunId: integer("pay_run_id").references(() => payRunsTable.id, { onDelete: "cascade" }).notNull(),
  action: text().$type<PayRunCommandAction>().notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payloadHash: text("payload_hash").notNull(),
  resultVersion: integer("result_version").notNull(),
  actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt,
}, (table) => [
  unique("pay_run_commands_idempotency_unique").on(table.idempotencyKey),
  index("pay_run_commands_run_action_idx").on(table.payRunId, table.action, table.id),
  check("pay_run_commands_action_valid", sql`${table.action} in ('calculate', 'approve', 'pay', 'post', 'void', 'reverse')`),
  check("pay_run_commands_key_uuid", sql`${table.idempotencyKey} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  check("pay_run_commands_payload_hash", sql`${table.payloadHash} ~ '^[a-f0-9]{64}$'`),
  check("pay_run_commands_result_version_positive", sql`${table.resultVersion} > 0`),
]);

export type EmployeeFinanceProfile = typeof employeeFinanceProfilesTable.$inferSelect;
export type CompensationVersion = typeof compensationVersionsTable.$inferSelect;
export type CompensationComponent = typeof compensationComponentsTable.$inferSelect;
export type PayRun = typeof payRunsTable.$inferSelect;
export type PayRunEmployee = typeof payRunEmployeesTable.$inferSelect;
export type PayRunLine = typeof payRunLinesTable.$inferSelect;
