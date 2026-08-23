import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt, isActive } from "./_helpers";
import { AddressType, Role } from "../../utils/types";

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id,
  fname: text().notNull(),
  lname: text().notNull(),
  password: text().notNull(),
  email: text().unique().notNull(),
  role: text().$type<Role>().default("user").notNull(),
  isActive,
  createdAt,
  updatedAt,
});

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
