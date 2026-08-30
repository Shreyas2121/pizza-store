import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";
import type { AuditOutcome } from "../../utils/types";

// ──────────────────────────────────────────────
// Audit Logs (append-only)
// ──────────────────────────────────────────────

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    actorEmailSnapshot: text("actor_email_snapshot"),
    platformRole: text("platform_role"),
    storeId: integer("store_id").references(() => storesTable.id, {
      onDelete: "set null",
    }),
    action: text().notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    outcome: text()
      .$type<AuditOutcome>()
      .default("success")
      .notNull(),
    requestId: text("request_id"),
    metadata: jsonb()
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_store_created_at_idx").on(
      table.storeId,
      table.createdAt.desc()
    ),
    index("audit_logs_actor_created_at_idx").on(
      table.actorUserId,
      table.createdAt.desc()
    ),
    index("audit_logs_action_created_at_idx").on(
      table.action,
      table.createdAt.desc()
    ),
    check(
      "audit_logs_outcome_valid",
      sql`${table.outcome} in ('success', 'failure', 'denied')`
    ),
  ]
);
