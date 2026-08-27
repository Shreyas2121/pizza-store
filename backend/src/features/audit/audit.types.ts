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

export type AuditAction = StaffAuditAction | StoreAuditAction;

export type AuditResourceType =
  | "store_membership"
  | "store_staff_invitation"
  | "store"
  | "store_product"
  | "delivery_zone";

export interface StaffAuditState {
  role?: StoreRole;
  status?: StoreMembershipStatus;
  [key: string]: unknown;
}

export interface WriteAuditInput {
  tx: TransactionType;
  actor: AuthPrincipal;
  storeId: number;
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
