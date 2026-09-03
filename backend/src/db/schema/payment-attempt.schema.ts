import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import {
  PaymentAttemptStatus,
  PaymentCurrency,
  PaymentMethod,
  PaymentProvider,
  RazorpayProviderStatus,
} from "../../utils/types";
import { ordersTable } from "./order.schema";
import { storesTable } from "./store.schema";

// ──────────────────────────────────────────────
// Payment Attempts (Order-to-Many Aggregate)
// ──────────────────────────────────────────────

export const paymentAttemptsTable = pgTable(
  "payment_attempts",
  {
    id,
    orderId: integer("order_id")
      .references(() => ordersTable.id)
      .notNull(),
    storeId: integer("store_id")
      .references(() => storesTable.id)
      .notNull(),
    provider: text().$type<PaymentProvider>().default("cod").notNull(),
    method: text().$type<PaymentMethod>(),
    status: text().$type<PaymentAttemptStatus>().default("pending").notNull(),
    providerStatus: text("provider_status").$type<RazorpayProviderStatus>(),
    amountPaise: integer("amount_paise").default(0).notNull(),
    currency: text().$type<PaymentCurrency>().default("INR").notNull(),
    providerOrderId: text("provider_order_id").unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    clientRequestId: text("client_request_id").unique(),
    failureCode: text("failure_code"),
    failureDescription: text("failure_description"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("payment_attempts_order_id_idx").on(table.orderId),
    index("payment_attempts_store_id_idx").on(table.storeId),
    index("payment_attempts_status_idx").on(table.status),
    unique("payment_attempts_refund_scope_unique").on(
      table.id,
      table.orderId,
      table.storeId
    ),
    check(
      "payment_attempts_amount_paise_nonnegative",
      sql`${table.amountPaise} >= 0`
    ),
    check(
      "payment_attempts_provider_valid",
      sql`${table.provider} in ('cod', 'razorpay')`
    ),
    check(
      "payment_attempts_status_valid",
      sql`${table.status} in ('pending', 'processing', 'authorized', 'captured', 'failed', 'expired', 'cancelled', 'voided')`
    ),
    check("payment_attempts_currency_inr", sql`${table.currency} = 'INR'`),
    check(
      "payment_attempts_method_valid",
      sql`${table.method} is null or ${table.method} in ('cash', 'card', 'upi', 'netbanking', 'wallet', 'other')`
    ),
  ]
);

export type PaymentAttempt = typeof paymentAttemptsTable.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttemptsTable.$inferInsert;
