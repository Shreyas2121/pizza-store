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
import type { AuthPrincipal, PlatformRole } from "../features/auth/auth.types";

export type AddressType = "Home" | "Work" | "Other";
export type Role = PlatformRole;
export const STORE_ROLES = [
  "manager",
  "finance_manager",
  "payroll_manager",
  "operator",
  "inventory_staff",
] as const;
export type StoreRole = (typeof STORE_ROLES)[number];
export type StoreMembershipStatus = "active" | "suspended" | "revoked";
export type AuditOutcome = "success" | "failure" | "denied";
export type CustomizationType = "single" | "multiple";
export const ORDER_STATUSES = [
  "awaiting_payment",
  "pending",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";
export const PAYMENT_ATTEMPT_STATUSES = [
  "pending",
  "processing",
  "authorized",
  "captured",
  "failed",
  "expired",
  "cancelled",
  "voided",
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "upi",
  "netbanking",
  "wallet",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
export const REFUND_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "cancelled",
  "submitted",
  "processing",
  "processed",
  "failed",
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];
export const REFUND_ALLOCATION_KINDS = ["item", "delivery_fee"] as const;
export type RefundAllocationKind = (typeof REFUND_ALLOCATION_KINDS)[number];
export const SETTLEMENT_BATCH_STATUSES = [
  "imported",
  "reconciling",
  "needs_review",
  "reconciled",
] as const;
export type SettlementBatchStatus = (typeof SETTLEMENT_BATCH_STATUSES)[number];
export const SETTLEMENT_LINE_TYPES = [
  "payment",
  "refund",
  "adjustment",
] as const;
export type SettlementLineType = (typeof SETTLEMENT_LINE_TYPES)[number];
export const SETTLEMENT_MATCH_STATUSES = [
  "unmatched",
  "matched",
  "mismatch",
  "ignored",
] as const;
export type SettlementMatchStatus = (typeof SETTLEMENT_MATCH_STATUSES)[number];
export const RECONCILIATION_ISSUE_TYPES = [
  "missing_local",
  "missing_provider",
  "amount_mismatch",
  "currency_mismatch",
  "duplicate",
  "unexpected_status",
  "stale_pending",
] as const;
export type ReconciliationIssueType = (typeof RECONCILIATION_ISSUE_TYPES)[number];
export type ReconciliationIssueSeverity = "info" | "warning" | "error" | "critical";
export type ReconciliationIssueStatus = "open" | "resolved";
export const FINANCIAL_OUTBOX_STATUSES = [
  "pending", "processing", "processed", "failed", "dead_letter",
] as const;
export type FinancialOutboxStatus = (typeof FINANCIAL_OUTBOX_STATUSES)[number];
export const CASH_SESSION_STATUSES = ["open", "closed"] as const;
export type CashSessionStatus = (typeof CASH_SESSION_STATUSES)[number];
export const CASH_MOVEMENT_TYPES = [
  "cod_collection", "refund", "cash_in", "cash_out", "deposit", "adjustment",
] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];
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

export interface AuthenticatedRequest extends Request {
  principal?: AuthPrincipal;
}

export type Auth = AuthenticatedRequest;
