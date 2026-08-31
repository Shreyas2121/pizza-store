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
  manager: [
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
    "finance.overview.read",
    "finance.sales.read",
    "finance.expenses.read",
    "finance.expenses.create",
    "finance.expenses.approve",
    "finance.refunds.create",
    "finance.refunds.approve",
    "finance.cash.manage",
    "finance.settlements.read",
  ],
  finance_manager: [
    "dashboard.operations.read",
    "dashboard.finance.read",
    "orders.read",
    "inventory.read",
    "store.products.read",
    "finance.overview.read",
    "finance.sales.read",
    "finance.expenses.read",
    "finance.expenses.create",
    "finance.expenses.approve",
    "finance.expenses.pay",
    "finance.refunds.create",
    "finance.refunds.approve",
    "finance.cash.manage",
    "finance.settlements.read",
    "finance.reconciliation.manage",
    "finance.ledger.read",
    "finance.ledger.post",
  ],
  payroll_manager: [
    "payroll.read",
    "payroll.manage",
    "payroll.calculate",
    "payroll.approve",
    "payroll.pay",
  ],
  operator: [
    "dashboard.operations.read",
    "orders.read",
    "orders.update_status",
    "inventory.read",
    "store.products.read",
    "finance.refunds.create",
    "finance.cash.manage",
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
