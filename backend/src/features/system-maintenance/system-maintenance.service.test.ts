import { describe, expect, it, vi } from "vitest";
import { auditLogsTable, usersTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import {
  APPLICATION_DATA_TABLE_NAMES,
  SystemMaintenanceService,
  TRUNCATE_APPLICATION_DATA_SQL,
} from "./system-maintenance.service";

const expectedApplicationTables = [
  "addresses",
  "audit_logs",
  "cart",
  "cart_item_customizations",
  "cart_items",
  "categories",
  "chat_messages",
  "chat_sessions",
  "coupon_redemptions",
  "coupons",
  "customization_groups",
  "customization_options",
  "delivery_price",
  "delivery_zones",
  "inventory_movements",
  "inventory_reservations",
  "menu_items",
  "menu_items_mapping",
  "order_item_customizations",
  "order_items",
  "orders",
  "payment_webhook_events",
  "payments",
  "product_customization_group_mapping",
  "products",
  "store_memberships",
  "store_products",
  "store_staff_invitations",
  "stores",
];

const createTransaction = (requestingRole: "admin" | "user" = "admin") => {
  const execute = vi.fn().mockResolvedValue(undefined);
  const deleteReturning = vi.fn().mockResolvedValue([{ id: 4 }, { id: 5 }]);
  const deleteWhere = vi.fn().mockReturnValue({ returning: deleteReturning });
  const deleteFrom = vi.fn().mockReturnValue({ where: deleteWhere });
  const firstLimit = vi
    .fn()
    .mockResolvedValue([{ id: 1, role: requestingRole, email: "admin@example.com" }]);
  const firstFor = vi.fn().mockReturnValue({ limit: firstLimit });
  const firstWhere = vi.fn().mockReturnValue({ for: firstFor });
  const firstFrom = vi.fn().mockReturnValue({ where: firstWhere });
  const secondWhere = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const secondFrom = vi.fn().mockReturnValue({ where: secondWhere });
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: firstFrom })
    .mockReturnValueOnce({ from: secondFrom });
  const auditValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: auditValues });

  return {
    tx: {
      execute,
      delete: deleteFrom,
      select,
      insert,
    } as unknown as TransactionType,
    execute,
    deleteFrom,
    insert,
    auditValues,
  };
};

const adminPrincipal = {
  userId: 1,
  email: "admin@example.com",
  platformRole: "admin" as const,
};

describe("SystemMaintenanceService", () => {
  it("covers every application table while excluding users", () => {
    expect([...APPLICATION_DATA_TABLE_NAMES].sort()).toEqual(
      expectedApplicationTables.sort()
    );
    expect(APPLICATION_DATA_TABLE_NAMES).not.toContain("users");
    expect(TRUNCATE_APPLICATION_DATA_SQL).not.toContain('"users"');
    for (const tableName of expectedApplicationTables) {
      expect(TRUNCATE_APPLICATION_DATA_SQL).toContain(`"${tableName}"`);
    }
  });

  it("clears application tables and deletes only non-admin users", async () => {
    const service = new SystemMaintenanceService();
    const { tx, execute, deleteFrom, insert, auditValues } = createTransaction();

    const result = await service.clearAllExceptAdmins(adminPrincipal, tx);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(deleteFrom).toHaveBeenCalledWith(usersTable);
    expect(insert).toHaveBeenCalledWith(auditLogsTable);
    expect(auditValues).toHaveBeenCalledTimes(1);
    expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 1,
      action: "system.clear_all",
      resourceType: "system",
    }));
    expect(result).toEqual({
      cleared: true,
      clearedTableCount: expectedApplicationTables.length,
      deletedNonAdminUsers: 2,
      preservedAdminUsers: 2,
    });
  });

  it("stops before truncation when the requesting account is not an admin", async () => {
    const service = new SystemMaintenanceService();
    const { tx, execute, deleteFrom } = createTransaction("user");

    await expect(service.clearAllExceptAdmins(adminPrincipal, tx)).rejects.toMatchObject({
      status: 403,
      code: "ADMIN_ACCOUNT_NOT_AUTHORIZED",
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(deleteFrom).not.toHaveBeenCalled();
  });
});
