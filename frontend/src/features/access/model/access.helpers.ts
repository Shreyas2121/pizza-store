import type { StoreAccessSummary, UserAccessResponse } from "./access.types";

export const isPlatformAdmin = (access?: UserAccessResponse | null): boolean => {
  return access?.platformRole === "admin";
};

export const hasStorePermission = (
  access: UserAccessResponse | null | undefined,
  storeId: number | null | undefined,
  permission: string
): boolean => {
  if (!access) return false;
  if (access.platformRole === "admin") return true;
  if (!storeId) return false;

  const membership = access.memberships.find((m) => m.store.id === storeId);
  if (!membership) return false;

  return membership.permissions.includes(permission);
};

export const getAccessibleStores = (
  access?: UserAccessResponse | null
): StoreAccessSummary[] => {
  if (!access) return [];
  return access.memberships.map((m) => m.store);
};

export const getActiveMembershipRole = (
  access: UserAccessResponse | null | undefined,
  storeId: number | null | undefined
): "manager" | "operator" | "inventory_staff" | "admin" | null => {
  if (!access) return null;
  if (access.platformRole === "admin") return "admin";
  if (!storeId) return null;

  const membership = access.memberships.find((m) => m.store.id === storeId);
  return membership ? membership.role : null;
};
