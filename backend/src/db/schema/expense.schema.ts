import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { ExpensePaymentMethod, ExpenseStatus, PaymentCurrency } from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";
import { expenseCategoriesTable, vendorsTable } from "./vendor.schema";

export const expensesTable = pgTable("expenses", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  vendorId: integer("vendor_id").references(() => vendorsTable.id),
  vendorName: text("vendor_name"),
  expenseDate: date("expense_date", { mode: "string" }).notNull(),
  description: text().notNull(),
  subtotalPaise: integer("subtotal_paise").notNull(),
  taxPaise: integer("tax_paise").default(0).notNull(),
  totalPaise: integer("total_paise").notNull(),
  currency: text().$type<PaymentCurrency>().default("INR").notNull(),
  status: text().$type<ExpenseStatus>().default("draft").notNull(),
  paymentMethod: text("payment_method").$type<ExpensePaymentMethod>(),
  paymentReference: text("payment_reference"),
  clientRequestId: text("client_request_id").notNull().unique(),
  payloadHash: text("payload_hash").notNull(),
  version: integer().default(1).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id).notNull(),
  updatedBy: integer("updated_by").references(() => usersTable.id).notNull(),
  submittedBy: integer("submitted_by").references(() => usersTable.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedBy: integer("rejected_by").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  paidBy: integer("paid_by").references(() => usersTable.id),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  postedBy: integer("posted_by").references(() => usersTable.id),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  voidedBy: integer("voided_by").references(() => usersTable.id),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  reversedBy: integer("reversed_by").references(() => usersTable.id),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  createdAt,
  updatedAt,
}, (table) => [
  unique("expenses_id_store_unique").on(table.id, table.storeId),
  index("expenses_store_date_idx").on(table.storeId, table.expenseDate.desc(), table.id.desc()),
  index("expenses_store_status_idx").on(table.storeId, table.status),
  check("expenses_status_valid", sql`${table.status} in ('draft','submitted','approved','paid','posted','rejected','voided','reversed')`),
  check("expenses_currency_inr", sql`${table.currency} = 'INR'`),
  check("expenses_amounts_valid", sql`${table.subtotalPaise} >= 0 and ${table.taxPaise} >= 0 and ${table.totalPaise} > 0 and ${table.totalPaise} <= 50000000 and ${table.totalPaise}::bigint = ${table.subtotalPaise}::bigint + ${table.taxPaise}::bigint`),
  check("expenses_description_present", sql`nullif(btrim(${table.description}), '') is not null and char_length(${table.description}) <= 1000`),
  check("expenses_payload_hash_valid", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
  check("expenses_version_positive", sql`${table.version} > 0`),
  check("expenses_payment_method_valid", sql`${table.paymentMethod} is null or ${table.paymentMethod} in ('bank_transfer','cash','card','upi','other')`),
  check("expenses_submission_evidence", sql`(${table.status} not in ('submitted','approved','paid','posted','rejected','reversed')) or (${table.submittedBy} is not null and ${table.submittedAt} is not null)`),
  check("expenses_payment_evidence", sql`(${table.status} not in ('paid','posted','reversed')) or (${table.paidBy} is not null and ${table.paidAt} is not null and ${table.paymentMethod} is not null)`),
  check("expenses_approval_evidence", sql`(${table.status} not in ('approved','paid','posted','reversed')) or (${table.approvedBy} is not null and ${table.approvedAt} is not null)`),
  check("expenses_rejection_evidence", sql`(${table.status} <> 'rejected') or (${table.rejectedBy} is not null and ${table.rejectedAt} is not null and nullif(btrim(${table.rejectionReason}), '') is not null)`),
  check("expenses_posting_evidence", sql`(${table.status} not in ('posted','reversed')) or (${table.postedBy} is not null and ${table.postedAt} is not null)`),
  check("expenses_void_evidence", sql`(${table.status} <> 'voided') or (${table.voidedBy} is not null and ${table.voidedAt} is not null and nullif(btrim(${table.voidReason}), '') is not null)`),
  check("expenses_reversal_evidence", sql`(${table.status} <> 'reversed') or (${table.reversedBy} is not null and ${table.reversedAt} is not null and nullif(btrim(${table.reversalReason}), '') is not null)`),
]);

export const expenseAllocationsTable = pgTable("expense_allocations", {
  id,
  expenseId: integer("expense_id").notNull(),
  expenseStoreId: integer("expense_store_id").notNull(),
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  categoryId: integer("category_id").references(() => expenseCategoriesTable.id).notNull(),
  categoryName: text("category_name").notNull(),
  categoryClassification: text("category_classification").$type<"fixed" | "variable">().notNull(),
  ledgerAccountId: integer("ledger_account_id"),
  costCenter: text("cost_center"),
  amountPaise: integer("amount_paise").notNull(),
  createdAt,
}, (table) => [
  foreignKey({ columns: [table.expenseId, table.expenseStoreId], foreignColumns: [expensesTable.id, expensesTable.storeId], name: "expense_allocations_expense_store_fk" }).onDelete("cascade"),
  index("expense_allocations_store_category_idx").on(table.storeId, table.categoryId),
  check("expense_allocations_amount_positive", sql`${table.amountPaise} > 0 and ${table.amountPaise} <= 50000000`),
  check("expense_allocations_category_snapshot_valid", sql`nullif(btrim(${table.categoryName}), '') is not null and ${table.categoryClassification} in ('fixed','variable')`),
  check("expense_allocations_cost_center_valid", sql`${table.costCenter} is null or (nullif(btrim(${table.costCenter}), '') is not null and char_length(${table.costCenter}) <= 120)`),
  check("expense_allocations_ledger_account_positive", sql`${table.ledgerAccountId} is null or ${table.ledgerAccountId} > 0`),
]);

export const expenseCommandsTable = pgTable("expense_commands", {
  id,
  expenseId: integer("expense_id").references(() => expensesTable.id).notNull(),
  action: text().$type<"submit" | "approve" | "reject" | "pay" | "post" | "void" | "reverse">().notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  payloadHash: text("payload_hash").notNull(),
  resultVersion: integer("result_version").notNull(),
  actorId: integer("actor_id").references(() => usersTable.id).notNull(),
  createdAt,
}, (table) => [
  index("expense_commands_expense_idx").on(table.expenseId),
  check("expense_commands_action_valid", sql`${table.action} in ('submit','approve','reject','pay','post','void','reverse')`),
  check("expense_commands_payload_hash_valid", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
  check("expense_commands_result_version_positive", sql`${table.resultVersion} > 0`),
]);

export type Expense = typeof expensesTable.$inferSelect;
export type ExpenseAllocation = typeof expenseAllocationsTable.$inferSelect;
