import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { CashMovementType, CashSessionStatus, PaymentCurrency } from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { ordersTable } from "./order.schema";
import { refundsTable } from "./refund.schema";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const cashSessionsTable = pgTable("cash_sessions", {
  id,
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  businessDate: date("business_date", { mode: "string" }).notNull(),
  status: text().$type<CashSessionStatus>().default("open").notNull(),
  currency: text().$type<PaymentCurrency>().default("INR").notNull(),
  openingFloatPaise: integer("opening_float_paise").notNull(),
  expectedCashPaise: integer("expected_cash_paise").notNull(),
  countedCashPaise: integer("counted_cash_paise"),
  variancePaise: integer("variance_paise"),
  materialVarianceAcknowledged: boolean("material_variance_acknowledged").default(false).notNull(),
  version: integer().default(1).notNull(),
  openedBy: integer("opened_by").references(() => usersTable.id).notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedBy: integer("closed_by").references(() => usersTable.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt,
  updatedAt,
}, (table) => [
  unique("cash_sessions_store_business_date_unique").on(table.storeId, table.businessDate),
  unique("cash_sessions_id_store_unique").on(table.id, table.storeId),
  index("cash_sessions_store_status_date_idx").on(table.storeId, table.status, table.businessDate),
  check("cash_sessions_status_valid", sql`${table.status} in ('open', 'closed')`),
  check("cash_sessions_currency_inr", sql`${table.currency} = 'INR'`),
  check("cash_sessions_amounts_valid", sql`${table.openingFloatPaise} >= 0 and ${table.expectedCashPaise} >= 0 and (${table.countedCashPaise} is null or ${table.countedCashPaise} >= 0)`),
  check("cash_sessions_version_positive", sql`${table.version} > 0`),
  check("cash_sessions_close_evidence", sql`(${table.status} = 'open' and ${table.countedCashPaise} is null and ${table.variancePaise} is null and ${table.closedBy} is null and ${table.closedAt} is null) or (${table.status} = 'closed' and ${table.countedCashPaise} is not null and ${table.variancePaise} = ${table.countedCashPaise} - ${table.expectedCashPaise} and ${table.closedBy} is not null and ${table.closedAt} is not null)`),
]);

export const cashMovementsTable = pgTable("cash_movements", {
  id,
  sessionId: integer("session_id").notNull(),
  storeId: integer("store_id").notNull(),
  type: text().$type<CashMovementType>().notNull(),
  amountPaise: integer("amount_paise").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id),
  refundId: integer("refund_id").references(() => refundsTable.id),
  reversesMovementId: integer("reverses_movement_id"),
  reason: text(),
  recordedBy: integer("recorded_by").references(() => usersTable.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt,
}, (table) => [
  foreignKey({
    columns: [table.sessionId, table.storeId],
    foreignColumns: [cashSessionsTable.id, cashSessionsTable.storeId],
    name: "cash_movements_session_store_fk",
  }),
  unique("cash_movements_order_unique").on(table.orderId),
  unique("cash_movements_refund_unique").on(table.refundId),
  unique("cash_movements_reversal_unique").on(table.reversesMovementId),
  index("cash_movements_session_occurred_idx").on(table.sessionId, table.occurredAt, table.id),
  check("cash_movements_type_valid", sql`${table.type} in ('cod_collection', 'refund', 'cash_in', 'cash_out', 'deposit', 'adjustment')`),
  check("cash_movements_amount_nonzero", sql`${table.amountPaise} <> 0`),
  check("cash_movements_source_valid", sql`(${table.type} = 'cod_collection' and ${table.orderId} is not null and ${table.refundId} is null and ${table.amountPaise} > 0) or (${table.type} = 'refund' and ${table.refundId} is not null and ${table.orderId} is null and ${table.amountPaise} < 0) or (${table.type} in ('cash_in', 'cash_out', 'deposit', 'adjustment') and ${table.orderId} is null and ${table.refundId} is null)`),
  check("cash_movements_manual_reason", sql`${table.type} in ('cod_collection', 'refund') or (nullif(btrim(${table.reason}), '') is not null and char_length(${table.reason}) <= 1000)`),
  check("cash_movements_manual_direction", sql`(${table.type} = 'cash_in' and ${table.amountPaise} > 0) or (${table.type} in ('cash_out', 'deposit') and ${table.amountPaise} < 0) or ${table.type} not in ('cash_in', 'cash_out', 'deposit')`),
]);

export const cashSessionClosuresTable = pgTable("cash_session_closures", {
  id,
  sessionId: integer("session_id").notNull(),
  storeId: integer("store_id").notNull(),
  sessionVersion: integer("session_version").notNull(),
  expectedCashPaise: integer("expected_cash_paise").notNull(),
  countedCashPaise: integer("counted_cash_paise").notNull(),
  variancePaise: integer("variance_paise").notNull(),
  materialVarianceAcknowledged: boolean("material_variance_acknowledged").default(false).notNull(),
  closedBy: integer("closed_by").references(() => usersTable.id).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull(),
  reversedBy: integer("reversed_by").references(() => usersTable.id),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversalReason: text("reversal_reason"),
  createdAt,
}, (table) => [
  foreignKey({ columns: [table.sessionId, table.storeId], foreignColumns: [cashSessionsTable.id, cashSessionsTable.storeId], name: "cash_session_closures_session_store_fk" }),
  unique("cash_session_closures_session_version_unique").on(table.sessionId, table.sessionVersion),
  index("cash_session_closures_session_idx").on(table.sessionId, table.closedAt),
  check("cash_session_closures_version_positive", sql`${table.sessionVersion} > 0`),
  check("cash_session_closures_amounts_valid", sql`${table.expectedCashPaise} >= 0 and ${table.countedCashPaise} >= 0 and ${table.variancePaise} = ${table.countedCashPaise} - ${table.expectedCashPaise}`),
  check("cash_session_closures_reversal_evidence", sql`(${table.reversedAt} is null and ${table.reversedBy} is null and ${table.reversalReason} is null) or (${table.reversedAt} is not null and ${table.reversedBy} is not null and nullif(btrim(${table.reversalReason}), '') is not null)`),
]);

export type CashSession = typeof cashSessionsTable.$inferSelect;
export type CashMovement = typeof cashMovementsTable.$inferSelect;
export type CashSessionClosure = typeof cashSessionClosuresTable.$inferSelect;
