export type StoreRole =
  | "manager"
  | "finance_manager"
  | "payroll_manager"
  | "operator"
  | "inventory_staff";

export type ActiveAccessRole = StoreRole | "admin";

export interface StoreAccessSummary {
  id: number;
  name: string;
  slug: string;
}

export interface MembershipAccess {
  membershipId: number;
  role: StoreRole;
  store: StoreAccessSummary;
  permissions: string[];
}

export interface UserAccessResponse {
  platformRole: "admin" | "user";
  platformAccess?: "all";
  memberships: MembershipAccess[];
}
