import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import {
  PaymentCurrency,
  PaymentProvider,
  PaymentStatus,
  RazorpayProviderStatus,
} from "../../utils/types";

// ──────────────────────────────────────────────
// Payments
// ──────────────────────────────────────────────

export const paymentsTable = pgTable(
  "payments",
  {
    id,
    provider: text().$type<PaymentProvider>().default("cod").notNull(),
    status: text().$type<PaymentStatus>().default("pending").notNull(),
    providerStatus: text("provider_status").$type<RazorpayProviderStatus>(),
    amountPaise: integer("amount_paise").default(0).notNull(),
    currency: text().$type<PaymentCurrency>().default("INR").notNull(),
    providerOrderId: text("provider_order_id").unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    clientRequestId: text("client_request_id").unique(),
    failureCode: text("failure_code"),
    failureDescription: text("failure_description"),
    /** @deprecated Use paidAt for completed payments. */
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("payments_status_idx").on(table.status),
    check("payments_amount_paise_nonnegative", sql`${table.amountPaise} >= 0`),
    check(
      "payments_provider_valid",
      sql`${table.provider} in ('cod', 'razorpay')`
    ),
    check("payments_currency_inr", sql`${table.currency} = 'INR'`),
  ]
);
