import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import type { PaymentWebhookEventStatus } from "../../utils/types";

export const paymentWebhookEventsTable = pgTable(
  "payment_webhook_events",
  {
    id,
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    status: text()
      .$type<PaymentWebhookEventStatus>()
      .default("processing")
      .notNull(),
    attempts: integer().default(1).notNull(),
    lastError: text("last_error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("payment_webhook_events_status_idx").on(table.status),
    check(
      "payment_webhook_events_status_valid",
      sql`${table.status} in ('processing', 'processed', 'failed')`
    ),
    check(
      "payment_webhook_events_attempts_positive",
      sql`${table.attempts} >= 1`
    ),
  ]
);
