import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { AddressType, Role } from "../../utils/types";

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

export const usersTable = pgTable(
  "users",
  {
    id,
    fname: text().notNull(),
    lname: text().notNull(),
    password: text().notNull(),
    email: text().notNull(),
    role: text().$type<Role>().default("user").notNull(),
    tokenVersion: integer("token_version").default(0).notNull(),
    isActive,
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("users_lower_email_unique").on(sql`lower(${table.email})`),
    check("users_token_version_nonnegative", sql`${table.tokenVersion} >= 0`),
  ]
);

// ──────────────────────────────────────────────
// Addresses
// ──────────────────────────────────────────────

export const addressTable = pgTable("addresses", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  type: text("type").$type<AddressType>().notNull(),
  street: text("street").notNull(),
  city: text().notNull(),
  state: text().notNull(),
  pincode: text().notNull(),
  phone: text().notNull(),
  createdAt,
  updatedAt,
});
