import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { storesTable } from "./store.schema";
import { usersTable } from "./user.schema";
import type { StoreMembershipStatus, StoreRole } from "../../utils/types";

// ──────────────────────────────────────────────
// Store Memberships
// ──────────────────────────────────────────────

export const storeMembershipsTable = pgTable(
  "store_memberships",
  {
    id,
    userId: integer("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    storeId: integer("store_id")
      .references(() => storesTable.id, { onDelete: "cascade" })
      .notNull(),
    role: text().$type<StoreRole>().notNull(),
    status: text()
      .$type<StoreMembershipStatus>()
      .default("active")
      .notNull(),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    updatedBy: integer("updated_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("store_memberships_user_id_store_id_unique").on(
      table.userId,
      table.storeId
    ),
    index("store_memberships_user_status_store_idx").on(
      table.userId,
      table.status,
      table.storeId
    ),
    index("store_memberships_store_status_role_idx").on(
      table.storeId,
      table.status,
      table.role
    ),
    check(
      "store_memberships_role_valid",
      sql`${table.role} in ('manager', 'finance_manager', 'payroll_manager', 'operator', 'inventory_staff')`
    ),
    check(
      "store_memberships_status_valid",
      sql`${table.status} in ('active', 'suspended', 'revoked')`
    ),
  ]
);

// ──────────────────────────────────────────────
// Store Staff Invitations
// ──────────────────────────────────────────────

export const storeStaffInvitationsTable = pgTable(
  "store_staff_invitations",
  {
    id,
    storeId: integer("store_id")
      .references(() => storesTable.id, { onDelete: "cascade" })
      .notNull(),
    email: text().notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    role: text().$type<StoreRole>().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: integer("invited_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("store_staff_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("store_staff_invitations_active_store_email_unique")
      .on(table.storeId, table.normalizedEmail)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    check(
      "store_staff_invitations_role_valid",
      sql`${table.role} in ('manager', 'finance_manager', 'payroll_manager', 'operator', 'inventory_staff')`
    ),
    check(
      "store_staff_invitations_token_hash_format",
      sql`${table.tokenHash} ~ '^[a-f0-9]{64}$'`
    ),
  ]
);
