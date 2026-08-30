import { describe, expect, it } from "vitest";
import {
  PLATFORM_CAPABILITIES,
  STORE_PERMISSIONS,
  permissionsForRole,
  platformHasCapability,
  roleHasPermission,
  type Permission,
} from "./access.permissions";
import type { StoreRole } from "../../utils/types";

const expectedPermissions: Record<StoreRole, readonly Permission[]> = {
  manager: STORE_PERMISSIONS,
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
};

describe("store permission policy", () => {
  it.each(Object.entries(expectedPermissions) as [StoreRole, readonly Permission[]][])(
    "matches the complete %s permission matrix",
    (role, allowedPermissions) => {
      for (const permission of STORE_PERMISSIONS) {
        expect(roleHasPermission(role, permission), `${role}: ${permission}`).toBe(
          allowedPermissions.includes(permission)
        );
      }
      expect(permissionsForRole(role)).toEqual(allowedPermissions);
    }
  );

  it("denies unknown roles and permissions by default", () => {
    expect(roleHasPermission("unknown", "orders.read")).toBe(false);
    expect(roleHasPermission("manager", "unknown.permission")).toBe(false);
  });

  it("keeps platform capabilities separate and admin-only", () => {
    for (const capability of PLATFORM_CAPABILITIES) {
      expect(platformHasCapability("admin", capability)).toBe(true);
      expect(platformHasCapability("user", capability)).toBe(false);
    }
    expect(platformHasCapability("admin", "orders.read")).toBe(false);
  });
});
