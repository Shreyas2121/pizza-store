import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const ledgerAccountsTable = pgTable("ledger_accounts", {
  id,
  code: text().notNull(),
  name: text().notNull(),
  type: text().$type<"asset" | "liability" | "equity" | "revenue" | "expense" | "contra_revenue">().notNull(),
  normalSide: text("normal_side").$type<"debit" | "credit">().notNull(),
  parentId: integer("parent_id"),
  currency: text().$type<"INR">().default("INR").notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt,
  updatedAt,
}, (table) => [
  foreignKey({ columns: [table.parentId], foreignColumns: [table.id], name: "ledger_accounts_parent_fk" }),
  unique("ledger_accounts_code_unique").on(table.code),
  index("ledger_accounts_parent_idx").on(table.parentId),
  index("ledger_accounts_active_code_idx").on(table.isActive, table.code),
  check("ledger_accounts_code_valid", sql`${table.code} ~ '^[0-9]{4,10}$'`),
  check("ledger_accounts_name_present", sql`nullif(btrim(${table.name}), '') is not null and char_length(${table.name}) <= 160`),
  check("ledger_accounts_type_valid", sql`${table.type} in ('asset','liability','equity','revenue','expense','contra_revenue')`),
  check("ledger_accounts_normal_side_valid", sql`${table.normalSide} in ('debit','credit')`),
  check("ledger_accounts_type_side_valid", sql`(${table.type} in ('asset','expense','contra_revenue') and ${table.normalSide} = 'debit') or (${table.type} in ('liability','equity','revenue') and ${table.normalSide} = 'credit')`),
  check("ledger_accounts_currency_inr", sql`${table.currency} = 'INR'`),
  check("ledger_accounts_parent_not_self", sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`),
]);

export const journalEntriesTable = pgTable("journal_entries", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  journalNumber: text("journal_number").notNull(),
  businessDate: date("business_date", { mode: "string" }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  description: text().notNull(),
  currency: text().$type<"INR">().default("INR").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  eventType: text("event_type").notNull(),
  sourceVersion: integer("source_version").notNull(),
  commandHash: text("command_hash").notNull(),
  status: text().$type<"draft" | "posted" | "reversed">().default("draft").notNull(),
  postedBy: integer("posted_by").references(() => usersTable.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  reversalOfJournalEntryId: integer("reversal_of_journal_entry_id"),
  reversalReason: text("reversal_reason"),
  createdAt,
  updatedAt,
}, (table) => [
  foreignKey({ columns: [table.reversalOfJournalEntryId], foreignColumns: [table.id], name: "journal_entries_reversal_of_fk" }),
  unique("journal_entries_store_number_unique").on(table.storeId, table.journalNumber),
  unique("journal_entries_source_identity_unique").on(table.sourceType, table.sourceId, table.eventType, table.sourceVersion),
  unique("journal_entries_reversal_unique").on(table.reversalOfJournalEntryId),
  unique("journal_entries_id_store_unique").on(table.id, table.storeId),
  index("journal_entries_store_date_idx").on(table.storeId, table.businessDate.desc(), table.id.desc()),
  index("journal_entries_store_status_idx").on(table.storeId, table.status),
  index("journal_entries_finance_report_idx")
    .on(table.businessDate, table.storeId)
    .where(sql`${table.status} in ('posted', 'reversed') and ${table.currency} = 'INR'`),
  check("journal_entries_number_present", sql`nullif(btrim(${table.journalNumber}), '') is not null and char_length(${table.journalNumber}) <= 100`),
  check("journal_entries_description_present", sql`nullif(btrim(${table.description}), '') is not null and char_length(${table.description}) <= 500`),
  check("journal_entries_source_present", sql`nullif(btrim(${table.sourceType}), '') is not null and nullif(btrim(${table.sourceId}), '') is not null and nullif(btrim(${table.eventType}), '') is not null`),
  check("journal_entries_source_version_positive", sql`${table.sourceVersion} > 0`),
  check("journal_entries_command_hash_valid", sql`${table.commandHash} ~ '^[0-9a-f]{64}$'`),
  check("journal_entries_currency_inr", sql`${table.currency} = 'INR'`),
  check("journal_entries_status_valid", sql`${table.status} in ('draft','posted','reversed')`),
  check("journal_entries_posting_evidence", sql`(${table.status} = 'draft' and ${table.postedAt} is null) or (${table.status} in ('posted','reversed') and ${table.postedAt} is not null)`),
  check("journal_entries_reversal_evidence", sql`(${table.reversalOfJournalEntryId} is null and ${table.reversalReason} is null) or (${table.reversalOfJournalEntryId} is not null and nullif(btrim(${table.reversalReason}), '') is not null and ${table.status} in ('draft','posted'))`),
]);

export const journalLinesTable = pgTable("journal_lines", {
  id,
  journalEntryId: integer("journal_entry_id").references(() => journalEntriesTable.id, { onDelete: "cascade" }).notNull(),
  lineNumber: integer("line_number").notNull(),
  accountId: integer("account_id").references(() => ledgerAccountsTable.id).notNull(),
  debitPaise: integer("debit_paise").default(0).notNull(),
  creditPaise: integer("credit_paise").default(0).notNull(),
  description: text(),
  orderId: integer("order_id"),
  paymentAttemptId: integer("payment_attempt_id"),
  refundId: integer("refund_id"),
  expenseId: integer("expense_id"),
  payRunId: integer("pay_run_id"),
  dimensions: jsonb().$type<Record<string, string | number | boolean | null>>().default({}).notNull(),
  createdAt,
}, (table) => [
  unique("journal_lines_entry_line_unique").on(table.journalEntryId, table.lineNumber),
  index("journal_lines_account_entry_idx").on(table.accountId, table.journalEntryId),
  index("journal_lines_order_idx").on(table.orderId),
  index("journal_lines_payment_attempt_idx").on(table.paymentAttemptId),
  index("journal_lines_refund_idx").on(table.refundId),
  index("journal_lines_expense_idx").on(table.expenseId),
  check("journal_lines_line_number_positive", sql`${table.lineNumber} > 0`),
  check("journal_lines_exactly_one_side", sql`(${table.debitPaise} > 0 and ${table.creditPaise} = 0) or (${table.creditPaise} > 0 and ${table.debitPaise} = 0)`),
  check("journal_lines_description_valid", sql`${table.description} is null or (nullif(btrim(${table.description}), '') is not null and char_length(${table.description}) <= 500)`),
]);

export const fiscalPeriodsTable = pgTable("fiscal_periods", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  name: text().notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: text().$type<"open" | "soft_closed" | "closed">().default("open").notNull(),
  softClosedBy: integer("soft_closed_by").references(() => usersTable.id),
  softClosedAt: timestamp("soft_closed_at", { withTimezone: true }),
  closedBy: integer("closed_by").references(() => usersTable.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  unique("fiscal_periods_store_range_unique").on(table.storeId, table.startDate, table.endDate),
  index("fiscal_periods_store_dates_idx").on(table.storeId, table.startDate, table.endDate),
  index("fiscal_periods_store_status_idx").on(table.storeId, table.status),
  check("fiscal_periods_name_present", sql`nullif(btrim(${table.name}), '') is not null and char_length(${table.name}) <= 100`),
  check("fiscal_periods_range_valid", sql`${table.startDate} <= ${table.endDate}`),
  check("fiscal_periods_status_valid", sql`${table.status} in ('open','soft_closed','closed')`),
  check("fiscal_periods_soft_close_evidence", sql`(${table.status} = 'open' and ${table.softClosedBy} is null and ${table.softClosedAt} is null) or (${table.status} in ('soft_closed','closed') and ${table.softClosedBy} is not null and ${table.softClosedAt} is not null)`),
  check("fiscal_periods_close_evidence", sql`(${table.status} <> 'closed' and ${table.closedBy} is null and ${table.closedAt} is null) or (${table.status} = 'closed' and ${table.closedBy} is not null and ${table.closedAt} is not null)`),
]);

export type LedgerAccount = typeof ledgerAccountsTable.$inferSelect;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalLine = typeof journalLinesTable.$inferSelect;
export type FiscalPeriod = typeof fiscalPeriodsTable.$inferSelect;
