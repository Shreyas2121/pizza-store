import { db } from "../db";
import {
  addressTable,
  usersTable,
  categoriesTable,
  productsTable,
  menuItemsTable,
  cartTable,
  cartItemsTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  couponsTable,
  customizationGroupsTable,
  customizationOptionsTable,
} from "../db/schema";
import { NextFunction, Request, Response } from "express";

export type AddressType = "Home" | "Work" | "Other";
export type Role = "admin" | "user";
export type CustomizationType = "single" | "multiple";
export type OrderStatus = "pending" | "preparing" | "delievered" | "cancelled";
export type PaymentStatus = "pending" | "processing" | "completed" | "failed";
export type PaymentType = "cash" | "online";
export type CouponType = "percentage" | "fixed";

export type GroupT = "daily" | "weekly" | "monthly" | "quaterly" | "yearly";

export type DatabaseType = typeof db;
export type TransactionType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type Fn = (req: Request, res: Response, next: NextFunction) => void;

export type User = typeof usersTable.$inferSelect;
export type Address = typeof addressTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type MenuItem = typeof menuItemsTable.$inferSelect;

export type Cart = typeof cartTable.$inferSelect;

export type CartItem = typeof cartItemsTable.$inferSelect;

export type Order = typeof ordersTable.$inferSelect;

export type OrderItem = typeof orderItemsTable.$inferSelect;

export type Payment = typeof paymentsTable.$inferSelect;

export type Coupon = typeof couponsTable.$inferSelect;

export type CustomizationGroup = typeof customizationGroupsTable.$inferSelect;

export type CustomizationOption = typeof customizationOptionsTable.$inferSelect;

export interface Auth extends Request {
  user?: User;
}
