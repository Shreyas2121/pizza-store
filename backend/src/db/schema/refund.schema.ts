import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  PaymentCurrency,
  RefundAllocationKind,
  RefundStatus,
} from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { orderItemsTable } from "./order.schema";
import { paymentAttemptsTable } from "./payment-attempt.schema";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const refundsTable = pgTable(
  "refunds",
  {
    id,
    orderId: integer("order_id").notNull(),
    paymentAttemptId: integer("payment_attempt_id").notNull(),
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text().$type<PaymentCurrency>().default("INR").notNull(),
    status: text().$type<RefundStatus>().default("requested").notNull(),
    reasonCode: text("reason_code").notNull(),
    reasonNote: text("reason_note"),
    clientRequestId: text("client_request_id").notNull().unique(),
    providerRefundId: text("provider_refund_id").unique(),
    providerStatus: text("provider_status"),
    failureCode: text("failure_code"),
    failureDescription: text("failure_description"),
    version: integer().default(1).notNull(),
    requestedBy: integer("requested_by")
      .references(() => usersTable.id)
      .notNull(),
    approvedBy: integer("approved_by").references(() => usersTable.id),
    rejectedBy: integer("rejected_by").references(() => usersTable.id),
    cancelledBy: integer("cancelled_by").references(() => usersTable.id),
    submittedBy: integer("submitted_by").references(() => usersTable.id),
    processedBy: integer("processed_by").references(() => usersTable.id),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    foreignKey({
      columns: [table.paymentAttemptId, table.orderId, table.storeId],
      foreignColumns: [
        paymentAttemptsTable.id,
        paymentAttemptsTable.orderId,
        paymentAttemptsTable.storeId,
      ],
      name: "refunds_payment_attempt_order_store_fk",
    }),
    index("refunds_store_requested_at_idx").on(
      table.storeId,
      table.requestedAt.desc()
    ),
    index("refunds_order_id_idx").on(table.orderId),
    index("refunds_payment_attempt_id_idx").on(table.paymentAttemptId),
    index("refunds_store_status_idx").on(table.storeId, table.status),
    check("refunds_amount_paise_positive", sql`${table.amountPaise} > 0`),
    check("refunds_currency_inr", sql`${table.currency} = 'INR'`),
    check(
      "refunds_status_valid",
      sql`${table.status} in ('requested', 'approved', 'rejected', 'cancelled', 'submitted', 'processing', 'processed', 'failed')`
    ),
    check(
      "refunds_reason_code_present",
      sql`nullif(btrim(${table.reasonCode}), '') is not null and char_length(${table.reasonCode}) <= 100`
    ),
    check(
      "refunds_reason_note_valid",
      sql`${table.reasonNote} is null or (nullif(btrim(${table.reasonNote}), '') is not null and char_length(${table.reasonNote}) <= 1000)`
    ),
    check(
      "refunds_client_request_id_present",
      sql`nullif(btrim(${table.clientRequestId}), '') is not null and char_length(${table.clientRequestId}) <= 255`
    ),
    check(
      "refunds_provider_refund_id_valid",
      sql`${table.providerRefundId} is null or nullif(btrim(${table.providerRefundId}), '') is not null`
    ),
    check("refunds_version_positive", sql`${table.version} > 0`),
    unique("refunds_allocation_scope_unique").on(table.id, table.orderId),
    check(
      "refunds_actor_timestamp_pairs",
      sql`(${table.approvedBy} is null) = (${table.approvedAt} is null)
        and (${table.rejectedBy} is null) = (${table.rejectedAt} is null)
        and (${table.cancelledBy} is null) = (${table.cancelledAt} is null)
        and (${table.submittedBy} is null) = (${table.submittedAt} is null)
        and (${table.processedBy} is null or ${table.processedAt} is not null)`
    ),
    check(
      "refunds_status_evidence",
      sql`(${table.status} not in ('approved', 'submitted', 'processing', 'processed', 'failed') or ${table.approvedAt} is not null)
        and (${table.status} not in ('submitted', 'processing', 'processed', 'failed') or ${table.submittedAt} is not null)
        and (${table.status} <> 'rejected' or ${table.rejectedAt} is not null)
        and (${table.status} <> 'cancelled' or ${table.cancelledAt} is not null)
        and (${table.status} <> 'processed' or ${table.processedAt} is not null)
        and (${table.status} <> 'failed' or ${table.failedAt} is not null)`
    ),
    check(
      "refunds_timestamps_ordered",
      sql`(${table.approvedAt} is null or ${table.approvedAt} >= ${table.requestedAt})
        and (${table.rejectedAt} is null or ${table.rejectedAt} >= ${table.requestedAt})
        and (${table.cancelledAt} is null or ${table.cancelledAt} >= ${table.requestedAt})
        and (${table.submittedAt} is null or ${table.submittedAt} >= ${table.requestedAt})
        and (${table.processedAt} is null or ${table.processedAt} >= ${table.requestedAt})
        and (${table.failedAt} is null or ${table.failedAt} >= ${table.requestedAt})`
    ),
  ]
);

export const refundAllocationsTable = pgTable(
  "refund_allocations",
  {
    id,
    refundId: integer("refund_id").notNull(),
    orderId: integer("order_id").notNull(),
    kind: text().$type<RefundAllocationKind>().notNull(),
    orderItemId: integer("order_item_id"),
    quantity: integer(),
    amountPaise: integer("amount_paise").notNull(),
    taxableAmountPaise: integer("taxable_amount_paise").notNull(),
    taxPaise: integer("tax_paise").notNull(),
    discountReversalPaise: integer("discount_reversal_paise")
      .default(0)
      .notNull(),
    createdAt,
  },
  (table) => [
    foreignKey({
      columns: [table.refundId, table.orderId],
      foreignColumns: [refundsTable.id, refundsTable.orderId],
      name: "refund_allocations_refund_order_fk",
    }),
    foreignKey({
      columns: [table.orderItemId, table.orderId],
      foreignColumns: [orderItemsTable.id, orderItemsTable.orderId],
      name: "refund_allocations_item_order_fk",
    }),
    index("refund_allocations_refund_id_idx").on(table.refundId),
    index("refund_allocations_order_item_id_idx").on(table.orderItemId),
    uniqueIndex("refund_allocations_item_unique")
      .on(table.refundId, table.orderItemId)
      .where(sql`${table.kind} = 'item'`),
    uniqueIndex("refund_allocations_delivery_fee_unique")
      .on(table.refundId, table.kind)
      .where(sql`${table.kind} = 'delivery_fee'`),
    check(
      "refund_allocations_kind_valid",
      sql`${table.kind} in ('item', 'delivery_fee')`
    ),
    check(
      "refund_allocations_target_valid",
      sql`(${table.kind} = 'item' and ${table.orderItemId} is not null and ${table.quantity} > 0)
        or (${table.kind} = 'delivery_fee' and ${table.orderItemId} is null and ${table.quantity} is null)`
    ),
    check(
      "refund_allocations_amounts_valid",
      sql`${table.amountPaise} > 0
        and ${table.taxableAmountPaise} >= 0
        and ${table.taxPaise} >= 0
        and ${table.discountReversalPaise} >= 0
        and ${table.taxableAmountPaise}::bigint + ${table.taxPaise}::bigint = ${table.amountPaise}::bigint`
    ),
  ]
);

export type Refund = typeof refundsTable.$inferSelect;
export type NewRefund = typeof refundsTable.$inferInsert;
export type RefundAllocation = typeof refundAllocationsTable.$inferSelect;
export type NewRefundAllocation = typeof refundAllocationsTable.$inferInsert;
