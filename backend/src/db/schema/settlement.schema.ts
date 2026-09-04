import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type {
  PaymentCurrency,
  ReconciliationIssueSeverity,
  ReconciliationIssueStatus,
  ReconciliationIssueType,
  SettlementBatchStatus,
  SettlementLineType,
  SettlementMatchStatus,
} from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { paymentAttemptsTable } from "./payment-attempt.schema";
import { refundsTable } from "./refund.schema";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const settlementBatchesTable = pgTable(
  "settlement_batches",
  {
    id,
    storeId: integer("store_id").references(() => storesTable.id).notNull(),
    provider: text().default("razorpay").notNull(),
    providerSettlementId: text("provider_settlement_id").notNull().unique(),
    providerStatus: text("provider_status").notNull(),
    status: text().$type<SettlementBatchStatus>().default("imported").notNull(),
    source: text().notNull(),
    periodFrom: timestamp("period_from", { withTimezone: true }).notNull(),
    periodTo: timestamp("period_to", { withTimezone: true }).notNull(),
    grossAmountPaise: integer("gross_amount_paise").notNull(),
    feePaise: integer("fee_paise").notNull(),
    feeTaxPaise: integer("fee_tax_paise").notNull(),
    adjustmentPaise: integer("adjustment_paise").default(0).notNull(),
    netAmountPaise: integer("net_amount_paise").notNull(),
    currency: text().$type<PaymentCurrency>().default("INR").notNull(),
    utr: text(),
    providerReference: text("provider_reference"),
    payloadHash: text("payload_hash").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),
    importedBy: integer("imported_by").references(() => usersTable.id).notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("settlement_batches_id_store_unique").on(table.id, table.storeId),
    index("settlement_batches_store_settled_at_idx").on(table.storeId, table.settledAt.desc()),
    index("settlement_batches_status_idx").on(table.status),
    check("settlement_batches_provider_valid", sql`${table.provider} = 'razorpay'`),
    check(
      "settlement_batches_provider_identity_present",
      sql`nullif(btrim(${table.providerSettlementId}), '') is not null
        and nullif(btrim(${table.providerStatus}), '') is not null`
    ),
    check("settlement_batches_source_valid", sql`${table.source} in ('fixture', 'test_provider')`),
    check("settlement_batches_status_valid", sql`${table.status} in ('imported', 'reconciling', 'needs_review', 'reconciled')`),
    check("settlement_batches_currency_inr", sql`${table.currency} = 'INR'`),
    check("settlement_batches_period_valid", sql`${table.periodTo} >= ${table.periodFrom}`),
    check("settlement_batches_settled_at_valid", sql`${table.settledAt} >= ${table.periodFrom}`),
    check(
      "settlement_batches_amounts_valid",
      sql`${table.grossAmountPaise} >= 0
        and ${table.feePaise} >= 0
        and ${table.feeTaxPaise} >= 0
        and ${table.netAmountPaise} >= 0
        and ${table.netAmountPaise}::bigint = ${table.grossAmountPaise}::bigint
          - ${table.feePaise}::bigint - ${table.feeTaxPaise}::bigint
          + ${table.adjustmentPaise}::bigint`
    ),
    check("settlement_batches_payload_hash_valid", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "settlement_batches_reconciled_evidence",
      sql`(${table.status} = 'reconciled') = (${table.reconciledAt} is not null)`
    ),
  ]
);

export const settlementLinesTable = pgTable(
  "settlement_lines",
  {
    id,
    batchId: integer("batch_id").notNull(),
    storeId: integer("store_id").notNull(),
    providerLineId: text("provider_line_id").notNull().unique(),
    providerTransactionId: text("provider_transaction_id").notNull(),
    providerEntityId: text("provider_entity_id").notNull(),
    type: text().$type<SettlementLineType>().notNull(),
    providerStatus: text("provider_status").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    feePaise: integer("fee_paise").default(0).notNull(),
    feeTaxPaise: integer("fee_tax_paise").default(0).notNull(),
    currency: text().$type<PaymentCurrency>().default("INR").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    matchStatus: text("match_status").$type<SettlementMatchStatus>().default("unmatched").notNull(),
    paymentAttemptId: integer("payment_attempt_id").references(() => paymentAttemptsTable.id),
    refundId: integer("refund_id").references(() => refundsTable.id),
    payloadHash: text("payload_hash").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    foreignKey({
      columns: [table.batchId, table.storeId],
      foreignColumns: [settlementBatchesTable.id, settlementBatchesTable.storeId],
      name: "settlement_lines_batch_store_fk",
    }),
    unique("settlement_lines_id_store_unique").on(table.id, table.storeId),
    index("settlement_lines_batch_id_idx").on(table.batchId),
    index("settlement_lines_store_match_idx").on(table.storeId, table.matchStatus),
    index("settlement_lines_provider_transaction_idx").on(table.providerTransactionId),
    check("settlement_lines_type_valid", sql`${table.type} in ('payment', 'refund', 'adjustment')`),
    check(
      "settlement_lines_provider_identity_present",
      sql`nullif(btrim(${table.providerLineId}), '') is not null
        and nullif(btrim(${table.providerTransactionId}), '') is not null
        and nullif(btrim(${table.providerEntityId}), '') is not null
        and nullif(btrim(${table.providerStatus}), '') is not null`
    ),
    check("settlement_lines_match_status_valid", sql`${table.matchStatus} in ('unmatched', 'matched', 'mismatch', 'ignored')`),
    check("settlement_lines_currency_inr", sql`${table.currency} = 'INR'`),
    check("settlement_lines_amount_nonzero", sql`${table.amountPaise} <> 0`),
    check("settlement_lines_fees_nonnegative", sql`${table.feePaise} >= 0 and ${table.feeTaxPaise} >= 0`),
    check("settlement_lines_payload_hash_valid", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "settlement_lines_local_target_valid",
      sql`(${table.type} = 'payment' and ${table.refundId} is null)
        or (${table.type} = 'refund' and ${table.paymentAttemptId} is null)
        or (${table.type} = 'adjustment' and ${table.paymentAttemptId} is null and ${table.refundId} is null)`
    ),
    check(
      "settlement_lines_matched_target_present",
      sql`${table.matchStatus} <> 'matched'
        or (${table.type} = 'payment' and ${table.paymentAttemptId} is not null)
        or (${table.type} = 'refund' and ${table.refundId} is not null)
        or ${table.type} = 'adjustment'`
    ),
  ]
);

export const reconciliationIssuesTable = pgTable(
  "reconciliation_issues",
  {
    id,
    storeId: integer("store_id").references(() => storesTable.id).notNull(),
    batchId: integer("batch_id"),
    settlementLineId: integer("settlement_line_id"),
    paymentAttemptId: integer("payment_attempt_id").references(() => paymentAttemptsTable.id),
    refundId: integer("refund_id").references(() => refundsTable.id),
    issueType: text("issue_type").$type<ReconciliationIssueType>().notNull(),
    severity: text().$type<ReconciliationIssueSeverity>().notNull(),
    status: text().$type<ReconciliationIssueStatus>().default("open").notNull(),
    ownerUserId: integer("owner_user_id").references(() => usersTable.id),
    details: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    resolutionNote: text("resolution_note"),
    resolvedBy: integer("resolved_by").references(() => usersTable.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    foreignKey({
      columns: [table.batchId, table.storeId],
      foreignColumns: [settlementBatchesTable.id, settlementBatchesTable.storeId],
      name: "reconciliation_issues_batch_store_fk",
    }),
    foreignKey({
      columns: [table.settlementLineId, table.storeId],
      foreignColumns: [settlementLinesTable.id, settlementLinesTable.storeId],
      name: "reconciliation_issues_line_store_fk",
    }),
    index("reconciliation_issues_store_status_idx").on(table.storeId, table.status),
    index("reconciliation_issues_batch_id_idx").on(table.batchId),
    check(
      "reconciliation_issues_type_valid",
      sql`${table.issueType} in ('missing_local', 'missing_provider', 'amount_mismatch', 'currency_mismatch', 'duplicate', 'unexpected_status', 'stale_pending')`
    ),
    check("reconciliation_issues_severity_valid", sql`${table.severity} in ('info', 'warning', 'error', 'critical')`),
    check("reconciliation_issues_status_valid", sql`${table.status} in ('open', 'resolved')`),
    check(
      "reconciliation_issues_resolution_valid",
      sql`(${table.status} = 'resolved' and ${table.resolvedBy} is not null and ${table.resolvedAt} is not null
          and nullif(btrim(${table.resolutionNote}), '') is not null)
        or (${table.status} = 'open' and ${table.resolvedBy} is null and ${table.resolvedAt} is null
          and ${table.resolutionNote} is null)`
    ),
  ]
);

export type SettlementBatch = typeof settlementBatchesTable.$inferSelect;
export type SettlementLine = typeof settlementLinesTable.$inferSelect;
export type ReconciliationIssue = typeof reconciliationIssuesTable.$inferSelect;
