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
  storesTable,
  storeProductsTable,
  storeMembershipsTable,
  storeStaffInvitationsTable,
  auditLogsTable,
} from "../db/schema";
import { NextFunction, Request, Response } from "express";

export type AddressType = "Home" | "Work" | "Other";
export type Role = "admin" | "user";
export type StoreRole = "manager" | "operator" | "inventory_staff";
export type StoreMembershipStatus = "active" | "suspended" | "revoked";
export type AuditOutcome = "success" | "failure" | "denied";
export type CustomizationType = "single" | "multiple";
export type OrderStatus =
  | "awaiting_payment"
  | "pending"
  | "preparing"
  | "delievered"
  | "cancelled";
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";
export type PaymentType = "cash" | "razorpay";
export type PaymentProvider = "cod" | "razorpay";
export type PaymentCurrency = "INR";
export type RazorpayOrderStatus = "created" | "attempted" | "paid";
export type RazorpayPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";
export type RazorpayProviderStatus =
  | RazorpayOrderStatus
  | RazorpayPaymentStatus;
export type PaymentWebhookEventStatus = "processing" | "processed" | "failed";
export type CouponRedemptionStatus = "reserved" | "consumed" | "released";
export type CouponType = "percentage" | "fixed";
export type ChatStatus = "open" | "close" | "rejected" | "pending";
export type InventoryChangeType =
  | "sale"
  | "restock"
  | "adjustment"
  | "return"
  | "cancellation";
export type InventoryReservationStatus =
  | "reserved"
  | "consumed"
  | "released";
export type StockStatus =
  | "untracked"
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export type GroupT = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type DatabaseType = typeof db;
export type TransactionType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export type Fn = (req: Request, res: Response, next: NextFunction) => void;

export type User = typeof usersTable.$inferSelect;
export type Address = typeof addressTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Store = typeof storesTable.$inferSelect;
export type StoreProduct = typeof storeProductsTable.$inferSelect;
export type MenuItem = typeof menuItemsTable.$inferSelect;

export type Cart = typeof cartTable.$inferSelect;

export type CartItem = typeof cartItemsTable.$inferSelect;

export type Order = typeof ordersTable.$inferSelect;

export type OrderItem = typeof orderItemsTable.$inferSelect;

export type Payment = typeof paymentsTable.$inferSelect;

export type Coupon = typeof couponsTable.$inferSelect;

export type CustomizationGroup = typeof customizationGroupsTable.$inferSelect;

export type CustomizationOption = typeof customizationOptionsTable.$inferSelect;

export type StoreMembership = typeof storeMembershipsTable.$inferSelect;

export type StoreStaffInvitation = typeof storeStaffInvitationsTable.$inferSelect;

export type AuditLog = typeof auditLogsTable.$inferSelect;

export interface Auth extends Request {
  user?: User;
}
