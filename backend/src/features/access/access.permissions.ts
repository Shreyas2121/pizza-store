import type { PlatformRole } from "../auth/auth.types";
import type { StoreRole } from "../../utils/types";

export const STORE_PERMISSIONS = [
  "dashboard.operations.read",
  "dashboard.finance.read",
  "orders.read",
  "orders.update_status",
  "inventory.read",
  "inventory.restock",
  "inventory.adjust",
  "inventory.threshold.update",
  "store.profile.update",
  "store.products.read",
  "store.products.mapping.manage",
  "store.products.price.update",
  "store.products.availability.update",
  "store.delivery_zones.read",
  "store.delivery_zones.manage",
  "store.staff.read",
  "store.staff.manage",
  "store.audit.read",
] as const;

export type Permission = (typeof STORE_PERMISSIONS)[number];

export const PLATFORM_CAPABILITIES = [
  "platform.catalog.manage",
  "platform.stores.create",
  "platform.stores.delete",
  "platform.store_managers.manage",
  "platform.coupons.manage",
  "platform.payments.reconcile",
  "platform.support.manage",
  "platform.audit.read",
  "platform.system.clear",
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

export const STORE_ROLE_PERMISSIONS = {
  manager: [...STORE_PERMISSIONS],
  operator: [
    "dashboard.operations.read",
    "orders.read",
    "orders.update_status",
    "inventory.read",
    "store.products.read",
  ],
  inventory_staff: [
    "dashboard.operations.read",
    "inventory.read",
    "inventory.restock",
    "inventory.adjust",
    "inventory.threshold.update",
    "store.products.read",
    "store.products.availability.update",
  ],
} as const satisfies Record<StoreRole, readonly Permission[]>;

const permissionSet = new Set<string>(STORE_PERMISSIONS);
const platformCapabilitySet = new Set<string>(PLATFORM_CAPABILITIES);

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && permissionSet.has(value);

export const isStoreRole = (value: unknown): value is StoreRole =>
  value === "manager" || value === "operator" || value === "inventory_staff";

export const isPlatformCapability = (
  value: unknown
): value is PlatformCapability =>
  typeof value === "string" && platformCapabilitySet.has(value);

export const permissionsForRole = (role: StoreRole): Permission[] => [
  ...STORE_ROLE_PERMISSIONS[role],
];

export const roleHasPermission = (
  role: StoreRole | string,
  permission: Permission | string
): boolean => {
  if (!isPermission(permission) || !isStoreRole(role)) {
    return false;
  }
  const allowedPermissions: readonly Permission[] = STORE_ROLE_PERMISSIONS[role];
  return allowedPermissions.includes(permission);
};

export const platformHasCapability = (
  platformRole: PlatformRole | string,
  capability: PlatformCapability | string
): boolean =>
  platformRole === "admin" && isPlatformCapability(capability);
