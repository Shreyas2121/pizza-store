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
export type SettlementAuditAction = "settlement.imported";

export type AuditAction = StaffAuditAction | StoreAuditAction | OrderAuditAction | InventoryAuditAction | RefundAuditAction | SettlementAuditAction | SystemAuditAction;

export type AuditResourceType =
  | "store_membership"
  | "store_staff_invitation"
  | "store"
  | "store_product"
  | "delivery_zone"
  | "order"
  | "refund"
  | "settlement_batch"
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
