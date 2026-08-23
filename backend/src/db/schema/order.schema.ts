import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { id, createdAt, updatedAt } from "./_helpers";
import { OrderStatus, PaymentType } from "../../utils/types";
import { usersTable, addressTable } from "./user.schema";
import { productsTable } from "./catalog.schema";
import { paymentsTable } from "./payment.schema";
import { couponsTable } from "./coupon.schema";
import { customizationOptionsTable } from "./customization.schema";
import { storesTable } from "./store.schema";

// ──────────────────────────────────────────────
// Orders
// ──────────────────────────────────────────────

export const ordersTable = pgTable("orders", {
  id,
  userId: integer("user_id")
    .references(() => usersTable.id)
    .notNull(),
  orderDate: timestamp("order_date", { withTimezone: true }).defaultNow(),
  discountAmount: doublePrecision("discount_amount").notNull(),
  couponId: integer("coupon_id").references(() => couponsTable.id),
  totalPrice: doublePrecision("total_price").default(0).notNull(),
  status: text().$type<OrderStatus>().default("pending").notNull(),
  paymentType: text("payment_type")
    .$type<PaymentType>()
    .default("cash")
    .notNull(),
  paymentId: integer("payment_id")
    .references(() => paymentsTable.id)
    .unique(),
  addressId: integer("address_id").references(() => addressTable.id),
  storeId: integer("store_id")
    .references(() => storesTable.id)
    .notNull(),
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Order Items
// ──────────────────────────────────────────────

export const orderItemsTable = pgTable("order_items", {
  id,
  orderId: integer("order_id")
    .references(() => ordersTable.id)
    .notNull(),
  productId: integer("product_id")
    .references(() => productsTable.id)
    .notNull(),
  quantity: integer().default(1).notNull(),
  price: doublePrecision("price").default(0).notNull(),
  createdAt,
  updatedAt,
});

// ──────────────────────────────────────────────
// Order Item Customizations
// ──────────────────────────────────────────────

export const orderItemCustomizationsTable = pgTable(
  "order_item_customizations",
  {
    id,
    orderItemId: integer("order_item_id")
      .references(() => orderItemsTable.id)
      .notNull(),
    customizationOptionId: integer("customization_option_id")
      .references(() => customizationOptionsTable.id)
      .notNull(),
    price: doublePrecision("price").notNull(),
    createdAt,
    updatedAt,
  }
);
