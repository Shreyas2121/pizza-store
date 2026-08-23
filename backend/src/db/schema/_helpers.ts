import {
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Reusable column helpers shared across all schema modules.
 * Import these instead of redefining per-table.
 */
export const id = integer().primaryKey().generatedAlwaysAsIdentity();
export const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();
export const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdateFn(() => new Date());
export const isActive = boolean("is_active").notNull().default(true);
