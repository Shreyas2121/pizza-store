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
export type ExpenseAuditAction =
  | "expense.created"
  | "expense.updated"
  | "expense.submitted"
  | "expense.approved"
  | "expense.rejected"
  | "expense.paid"
  | "expense.posted"
  | "expense.voided"
  | "expense.reversed"
  | "expense.attachment_uploaded";
export type LedgerAuditAction =
  | "ledger.period_opened"
  | "ledger.period_soft_closed"
  | "ledger.period_closed"
  | "ledger.period_reopened"
  | "ledger.manual_journal_posted"
  | "ledger.journal_reversed";
export type PayrollAuditAction =
  | "payroll.profile_created"
  | "payroll.profile_updated"
  | "payroll.compensation_version_created"
  | "payroll.pay_run_created"
  | "payroll.pay_run_calculated"
  | "payroll.pay_run_approved"
  | "payroll.pay_run_paid"
  | "payroll.pay_run_posted"
  | "payroll.pay_run_reversed"
  | "payroll.pay_run_voided";

export const HIGH_RISK_AUDIT_OPERATIONS = [
  "refund.reconcile",
  "refund.request",
  "refund.approve",
  "refund.reject",
  "refund.retry",
  "expense.approve",
  "expense.pay",
  "settlement.reconcile",
  "settlement.issue_resolve",
  "ledger.period_open",
  "ledger.period_soft_close",
  "ledger.period_close",
  "ledger.period_reopen",
  "ledger.manual_journal_post",
  "ledger.manual_journal_reverse",
  "payroll.compensation_change",
  "payroll.pay_run_calculate",
  "payroll.pay_run_approve",
  "payroll.pay_run_pay",
  "payroll.pay_run_post",
] as const;

export type HighRiskAuditOperation = (typeof HIGH_RISK_AUDIT_OPERATIONS)[number];
export type HighRiskAttemptAuditAction = `${HighRiskAuditOperation}.${"denied" | "failed"}`;

export type AuditAction = StaffAuditAction | StoreAuditAction | OrderAuditAction | InventoryAuditAction | RefundAuditAction | SettlementAuditAction | CostAuditAction | CashAuditAction | VendorAuditAction | ExpenseAuditAction | LedgerAuditAction | PayrollAuditAction | SystemAuditAction | HighRiskAttemptAuditAction;

export type AuditResourceType =
  | "store_membership"
  | "store_staff_invitation"
  | "store"
  | "store_product"
  | "delivery_zone"
  | "order"
  | "refund"
  | "settlement_batch"
  | "reconciliation_issue"
  | "product_cost_version"
  | "cash_session"
  | "cash_movement"
  | "vendor"
  | "expense_category"
  | "expense"
  | "expense_attachment"
  | "fiscal_period"
  | "journal_entry"
  | "employee_finance_profile"
  | "compensation_version"
  | "pay_run"
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
  outcome?: "success" | "failure";
  requestId?: string | null;
}

export interface WriteAuditAttemptInput {
  actor?: AuthPrincipal | null;
  storeId: number | null;
  operation: HighRiskAuditOperation;
  resourceType: AuditResourceType;
  resourceId: number | string;
  outcome: "failure" | "denied";
  reasonCode: string;
  requestId?: string | null;
}

export interface AuditWriter {
  write(input: WriteAuditInput): Promise<void>;
}
