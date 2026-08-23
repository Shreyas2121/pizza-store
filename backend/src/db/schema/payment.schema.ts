import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import { PaymentStatus } from "../../utils/types";

// ──────────────────────────────────────────────
// Payments
// ──────────────────────────────────────────────

export const paymentsTable = pgTable("payments", {
  id,
  status: text().$type<PaymentStatus>().default("pending").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt,
  updatedAt,
});
