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
import type {
  InventoryChangeType,
  InventoryReservationStatus,
} from "../../utils/types";
import { createdAt, id, updatedAt } from "./_helpers";
import { ordersTable } from "./order.schema";
import { storeProductsTable } from "./store.schema";
import { usersTable } from "./user.schema";

// ──────────────────────────────────────────────
// Inventory Reservations
// ──────────────────────────────────────────────

export const inventoryReservationsTable = pgTable(
  "inventory_reservations",
  {
    id,
    orderId: integer("order_id")
      .references(() => ordersTable.id)
      .notNull(),
    storeProductId: integer("store_product_id")
      .references(() => storeProductsTable.id)
      .notNull(),
    quantity: integer().notNull(),
    status: text()
      .$type<InventoryReservationStatus>()
      .default("reserved")
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("inventory_reservations_order_store_product_unique").on(
      table.orderId,
      table.storeProductId
    ),
    index("inventory_reservations_store_product_status_idx").on(
      table.storeProductId,
      table.status
    ),
    index("inventory_reservations_status_expires_at_idx").on(
      table.status,
      table.expiresAt
    ),
    check(
      "inventory_reservations_quantity_positive",
      sql`${table.quantity} > 0`
    ),
    check(
      "inventory_reservations_status_valid",
      sql`${table.status} in ('reserved', 'consumed', 'released')`
    ),
  ]
);

// ──────────────────────────────────────────────
// Inventory Movements
// ──────────────────────────────────────────────

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id,
    storeProductId: integer("store_product_id")
      .references(() => storeProductsTable.id)
      .notNull(),
    changeType: text("change_type").$type<InventoryChangeType>().notNull(),
    quantityChange: integer("quantity_change").notNull(),
    previousQuantity: integer("previous_quantity").notNull(),
    newQuantity: integer("new_quantity").notNull(),
    reason: text(),
    orderId: integer("order_id").references(() => ordersTable.id),
    idempotencyKey: text("idempotency_key"),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt,
  },
  (table) => [
    unique("inventory_movements_idempotency_key_unique").on(
      table.idempotencyKey
    ),
    index("inventory_movements_store_product_created_at_idx").on(
      table.storeProductId,
      table.createdAt.desc()
    ),
    index("inventory_movements_order_change_type_idx").on(
      table.orderId,
      table.changeType
    ),
    check(
      "inventory_movements_change_type_valid",
      sql`${table.changeType} in ('sale', 'restock', 'adjustment', 'return', 'cancellation')`
    ),
    check(
      "inventory_movements_quantity_equation_valid",
      sql`${table.newQuantity} = ${table.previousQuantity} + ${table.quantityChange}`
    ),
    check(
      "inventory_movements_quantities_nonnegative",
      sql`${table.previousQuantity} >= 0 and ${table.newQuantity} >= 0`
    ),
    check(
      "inventory_movements_adjustment_reason_required",
      sql`${table.changeType} <> 'adjustment' or nullif(btrim(${table.reason}), '') is not null`
    ),
  ]
);
