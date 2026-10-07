import { describe, expect, it, vi } from "vitest";
import { auditLogsTable, usersTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import {
  APPLICATION_DATA_TABLE_NAMES,
  SystemMaintenanceService,
  TRUNCATE_APPLICATION_DATA_SQL,
} from "./system-maintenance.service";

// Representative FK owners missed by the previous commerce-only reset list.
const requiredApplicationTables = [
  "promotion_applications", "promotion_discount_allocations",
  "promotions", "promotion_rules", "store_promotion_settings",
  "bundle_components", "order_item_bundle_components", "payment_attempts",
  "financial_outbox", "journal_entries", "journal_lines", "employee_finance_profiles",
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
  tokenVersion: 0,
  userId: 1,
  email: "admin@example.com",
  platformRole: "admin" as const,
};

describe("SystemMaintenanceService", () => {
  it("covers every application table while excluding users", () => {
    expect(APPLICATION_DATA_TABLE_NAMES).toEqual(expect.arrayContaining(requiredApplicationTables));
    expect(new Set(APPLICATION_DATA_TABLE_NAMES).size).toBe(APPLICATION_DATA_TABLE_NAMES.length);
    expect(APPLICATION_DATA_TABLE_NAMES).not.toContain("coupons");
    expect(APPLICATION_DATA_TABLE_NAMES).not.toContain("coupon_redemptions");
    expect(APPLICATION_DATA_TABLE_NAMES).not.toContain("users");
    expect(TRUNCATE_APPLICATION_DATA_SQL).not.toContain('"users"');
    for (const tableName of APPLICATION_DATA_TABLE_NAMES) {
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
      clearedTableCount: APPLICATION_DATA_TABLE_NAMES.length,
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
