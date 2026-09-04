import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import type { FinancialOutboxStatus, PaymentCurrency } from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";

export const financialOutboxTable = pgTable("financial_outbox", {
  id,
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  sourceVersion: integer("source_version").notNull(),
  storeId: integer("store_id").references(() => storesTable.id).notNull(),
  currency: text().$type<PaymentCurrency>().default("INR").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  businessDate: text("business_date").notNull(),
  timezone: text().notNull(),
  actorId: integer("actor_id").references(() => usersTable.id),
  correlationId: text("correlation_id"),
  causationId: text("causation_id"),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: text().$type<FinancialOutboxStatus>().default("pending").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  claimedBy: text("claimed_by"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt,
  updatedAt,
}, (table) => [
  unique("financial_outbox_source_event_version_unique").on(
    table.sourceType, table.sourceId, table.eventType, table.sourceVersion
  ),
  index("financial_outbox_claim_idx").on(table.status, table.availableAt, table.id),
  index("financial_outbox_store_occurred_idx").on(table.storeId, table.occurredAt),
  check("financial_outbox_event_id_present", sql`nullif(btrim(${table.eventId}), '') is not null`),
  check("financial_outbox_event_type_present", sql`nullif(btrim(${table.eventType}), '') is not null`),
  check("financial_outbox_source_present", sql`nullif(btrim(${table.sourceType}), '') is not null and nullif(btrim(${table.sourceId}), '') is not null`),
  check("financial_outbox_versions_positive", sql`${table.schemaVersion} > 0 and ${table.sourceVersion} > 0`),
  check("financial_outbox_currency_inr", sql`${table.currency} = 'INR'`),
  check("financial_outbox_business_date_valid", sql`${table.businessDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`),
  check("financial_outbox_timezone_present", sql`nullif(btrim(${table.timezone}), '') is not null`),
  check("financial_outbox_payload_hash_valid", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
  check("financial_outbox_status_valid", sql`${table.status} in ('pending', 'processing', 'processed', 'failed', 'dead_letter')`),
  check("financial_outbox_attempts_nonnegative", sql`${table.attemptCount} >= 0`),
  check("financial_outbox_claim_evidence", sql`(${table.status} = 'processing') = (${table.claimedAt} is not null and nullif(btrim(${table.claimedBy}), '') is not null)`),
  check("financial_outbox_processed_evidence", sql`(${table.status} = 'processed') = (${table.processedAt} is not null)`),
]);

export type FinancialOutboxEvent = typeof financialOutboxTable.$inferSelect;
