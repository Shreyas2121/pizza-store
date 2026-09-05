import type { AuthPrincipal } from "../auth/auth.types";
import type { StoreMembershipStatus, StoreRole, TransactionType } from "../../utils/types";

export type StaffAuditAction =
  | "staff.membership.assigned"
  | "staff.membership.updated"
  | "staff.membership.revoked"
  | "staff.invitation.created"
  | "staff.invitation.revoked"
  | "staff.invitation.accepted";

export type StoreAuditAction =
  | "store.profile.updated"
  | "store.products.mapped"
  | "store.product.updated"
  | "store.product.removed"
  | "store.delivery_zones.added"
  | "store.delivery_zone.deleted";

export type OrderAuditAction = "order.status.updated";
export type InventoryAuditAction =
  | "inventory.restocked"
  | "inventory.bulk_restocked"
  | "inventory.adjusted"
  | "inventory.threshold_updated";
export type SystemAuditAction = "system.clear_all";
export type RefundAuditAction =
  | "refund.requested"
  | "refund.approved"
  | "refund.rejected"
  | "refund.provider_submitted"
  | "refund.provider_processing"
  | "refund.provider_processed"
  | "refund.provider_failed";
export type SettlementAuditAction =
  | "settlement.imported"
  | "settlement.reconciled"
  | "settlement.issue_resolved";
export type CostAuditAction = "product_cost.version_created";
export type CashAuditAction =
  | "cash.session_opened"
  | "cash.session_closed"
  | "cash.session_reopened"
  | "cash.movement_recorded"
  | "cash.movement_reversed";
export type VendorAuditAction =
  | "vendor.created"
  | "vendor.updated"
  | "vendor.deactivated"
  | "vendor.reactivated"
  | "expense_category.created"
  | "expense_category.updated"
  | "expense_category.deactivated"
  | "expense_category.reactivated";

export type AuditAction = StaffAuditAction | StoreAuditAction | OrderAuditAction | InventoryAuditAction | RefundAuditAction | SettlementAuditAction | CostAuditAction | CashAuditAction | VendorAuditAction | SystemAuditAction;

export type AuditResourceType =
  | "store_membership"
  | "store_staff_invitation"
  | "store"
  | "store_product"
  | "delivery_zone"
  | "order"
  | "refund"
  | "settlement_batch"
  | "product_cost_version"
  | "cash_session"
  | "cash_movement"
  | "vendor"
  | "expense_category"
  | "system";

export interface StaffAuditState {
  role?: StoreRole;
  status?: StoreMembershipStatus;
  [key: string]: unknown;
}

export interface WriteAuditInput {
  tx: TransactionType;
  actor?: AuthPrincipal | null;
  storeId: number | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: number | string;
  before?: Record<string, unknown> | StaffAuditState;
  after?: Record<string, unknown> | StaffAuditState;
  metadata?: Record<string, unknown>;
}

export interface AuditWriter {
  write(input: WriteAuditInput): Promise<void>;
}
