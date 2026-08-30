export interface StoreAccessSummary {
  id: number;
  name: string;
  slug: string;
}

export interface MembershipAccess {
  membershipId: number;
  role: "manager" | "operator" | "inventory_staff";
  store: StoreAccessSummary;
  permissions: string[];
}

export interface UserAccessResponse {
  platformRole: "admin" | "user";
  memberships: MembershipAccess[];
}
