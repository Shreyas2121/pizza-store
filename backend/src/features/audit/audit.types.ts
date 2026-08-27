import type { AuthPrincipal } from "../auth/auth.types";
import type { StoreMembershipStatus, StoreRole, TransactionType } from "../../utils/types";

export type StaffAuditAction =
  | "staff.membership.assigned"
  | "staff.membership.updated"
  | "staff.membership.revoked"
  | "staff.invitation.created"
  | "staff.invitation.revoked"
  | "staff.invitation.accepted";

export interface StaffAuditState {
  role?: StoreRole;
  status?: StoreMembershipStatus;
}

export interface WriteAuditInput {
  tx: TransactionType;
  actor: AuthPrincipal;
  storeId: number;
  action: StaffAuditAction;
  resourceType: "store_membership" | "store_staff_invitation";
  resourceId: number;
  before?: StaffAuditState;
  after?: StaffAuditState;
}

export interface AuditWriter {
  write(input: WriteAuditInput): Promise<void>;
}
