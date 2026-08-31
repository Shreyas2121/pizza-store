import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "../auth/auth.types";
import type { StoreRole, TransactionType } from "../../utils/types";
import type {
  AccessRepository,
  MembershipAccessRecord,
} from "./access.types";
import {
  AuthorizationService,
  authenticationRequired,
  permissionDenied,
  resourceNotFound,
} from "./access.service";

const principal = (platformRole: "admin" | "user" = "user"): AuthPrincipal => ({
  userId: 17,
  email: "actor@example.com",
  platformRole,
  tokenVersion: 2,
});

const membership = (
  role: StoreRole = "manager",
  overrides: Partial<MembershipAccessRecord> = {}
): MembershipAccessRecord => ({
  membershipId: 12,
  userId: 17,
  storeId: 3,
  role,
  status: "active",
  storeIsActive: true,
  storeName: "Mumbai Central",
  storeSlug: "mumbai-central",
  ...overrides,
});

const createHarness = (memberships: MembershipAccessRecord[] = [membership()]) => {
  const repository: AccessRepository = {
    findMembership: vi.fn(async ({ userId, storeId }) =>
      memberships.find((row) => row.userId === userId && row.storeId === storeId)
    ),
    listMemberships: vi.fn(async ({ userId }) =>
      memberships.filter((row) => row.userId === userId)
    ),
  };
  const denialLogger = { warn: vi.fn() };
  return {
    service: new AuthorizationService(repository, denialLogger),
    repository,
    denialLogger,
  };
};

describe("AuthorizationService", () => {
  it("requires platform admin for platform capabilities", () => {
    const { service } = createHarness();

    expect(
      service.requirePlatformAdmin(principal("admin"), "platform.catalog.manage")
    ).toEqual({
      access: "platform",
      userId: 17,
      capability: "platform.catalog.manage",
    });
    expect(() =>
      service.requirePlatformAdmin(principal(), "platform.catalog.manage")
    ).toThrowError(
      expect.objectContaining({ status: 403, code: "PERMISSION_DENIED" })
    );
  });

  it("explicitly bypasses store membership lookup for a platform admin", async () => {
    const { service, repository } = createHarness([]);

    await expect(
      service.requireStorePermission({
        principal: principal("admin"),
        storeId: 99,
        permission: "finance.period.close",
      })
    ).resolves.toEqual({
      access: "platform",
      userId: 17,
      storeId: 99,
      permission: "finance.period.close",
    });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });

  it("returns membership authorization context for an allowed operation", async () => {
    const { service } = createHarness([membership("operator")]);

    await expect(
      service.requireStorePermission({
        principal: principal(),
        storeId: 3,
        permission: "orders.update_status",
      })
    ).resolves.toEqual({
      access: "membership",
      userId: 17,
      storeId: 3,
      permission: "orders.update_status",
      membershipId: 12,
      membershipRole: "operator",
    });
  });

  it.each([
    ["manager", "finance.expenses.approve", true],
    ["manager", "finance.expenses.pay", false],
    ["manager", "payroll.read", false],
    ["operator", "finance.refunds.create", true],
    ["operator", "finance.refunds.approve", false],
    ["finance_manager", "finance.ledger.post", true],
    ["finance_manager", "finance.period.close", false],
    ["finance_manager", "payroll.read", false],
    ["payroll_manager", "payroll.pay", true],
    ["payroll_manager", "finance.overview.read", false],
    ["inventory_staff", "finance.overview.read", false],
  ] as const)("enforces %s access to %s", async (role, permission, allowed) => {
    const { service } = createHarness([membership(role)]);
    const authorization = service.requireStorePermission({
      principal: principal(),
      storeId: 3,
      permission,
    });

    if (allowed) {
      await expect(authorization).resolves.toMatchObject({
        access: "membership",
        membershipRole: role,
        permission,
      });
    } else {
      await expect(authorization).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    }
  });

  it.each([
    ["ordinary user without membership", []],
    ["suspended membership", [membership("manager", { status: "suspended" })]],
    ["revoked membership", [membership("manager", { status: "revoked" })]],
    ["inactive store", [membership("manager", { storeIsActive: false })]],
    ["role without permission", [membership("operator")]],
  ])("denies %s", async (_name, memberships) => {
    const { service, denialLogger } = createHarness(memberships);

    await expect(
      service.requireStorePermission({
        principal: principal(),
        storeId: 3,
        permission: "inventory.restock",
      })
    ).rejects.toMatchObject({ status: 403, code: "PERMISSION_DENIED" });
    expect(denialLogger.warn).toHaveBeenCalledWith(
      "Authorization denied",
      expect.objectContaining({ actorUserId: 17, storeId: 3 })
    );
    expect(denialLogger.warn.mock.calls[0][1]).not.toHaveProperty("email");
    expect(denialLogger.warn.mock.calls[0][1]).not.toHaveProperty("tokenVersion");
  });

  it("filters accessible stores by active state and requested permission", async () => {
    const records = [
      membership("operator", { membershipId: 1, storeId: 1 }),
      membership("manager", { membershipId: 2, storeId: 2 }),
      membership("manager", {
        membershipId: 3,
        storeId: 3,
        status: "suspended",
      }),
      membership("manager", {
        membershipId: 4,
        storeId: 4,
        storeIsActive: false,
      }),
    ];
    const { service } = createHarness(records);

    await expect(
      service.getAccessibleStoreIds({
        principal: principal(),
        permission: "inventory.restock",
      })
    ).resolves.toEqual([2]);
    await expect(
      service.getAccessibleStoreIds({
        principal: principal(),
        permission: "orders.read",
      })
    ).resolves.toEqual([1, 2]);
    await expect(
      service.getAccessibleStoreIds({
        principal: principal("admin"),
        permission: "orders.read",
      })
    ).resolves.toBe("all");
  });

  it("propagates the caller transaction and membership lock request", async () => {
    const { service, repository } = createHarness();
    const tx = { marker: "caller-transaction" } as unknown as TransactionType;

    await service.requireStorePermission({
      principal: principal(),
      storeId: 3,
      permission: "inventory.restock",
      tx,
      lockMembership: true,
    });

    expect(repository.findMembership).toHaveBeenCalledWith({
      userId: 17,
      storeId: 3,
      executor: tx,
      lock: true,
    });
  });

  it("does not allow a membership lock outside the caller transaction", async () => {
    const { service, repository } = createHarness();

    await expect(
      service.requireStorePermission({
        principal: principal(),
        storeId: 3,
        permission: "inventory.restock",
        lockMembership: true,
      })
    ).rejects.toMatchObject({
      status: 500,
      code: "AUTHORIZATION_TRANSACTION_REQUIRED",
    });
    expect(repository.findMembership).not.toHaveBeenCalled();
  });

  it("uses stable authentication, permission, and hidden-resource failures", async () => {
    expect(authenticationRequired()).toMatchObject({
      status: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(permissionDenied()).toMatchObject({
      status: 403,
      code: "PERMISSION_DENIED",
    });
    expect(resourceNotFound()).toMatchObject({
      status: 404,
      code: "RESOURCE_NOT_FOUND",
    });

    const { service } = createHarness([]);
    expect(() => service.requirePlatformAdmin(undefined)).toThrowError(
      expect.objectContaining({ status: 401, code: "AUTHENTICATION_REQUIRED" })
    );
    await expect(
      service.requireResourceStorePermission({
        principal: principal(),
        resourceStoreId: 8,
        permission: "orders.read",
      })
    ).rejects.toMatchObject({ status: 404, code: "RESOURCE_NOT_FOUND" });
    await expect(
      service.requireResourceStorePermission({
        principal: principal(),
        resourceStoreId: null,
        permission: "orders.read",
      })
    ).rejects.toMatchObject({ status: 404, code: "RESOURCE_NOT_FOUND" });
  });

  it("returns a safe access/me DTO and an empty list for an ordinary customer", async () => {
    const records = [
      membership("manager"),
      membership("operator", {
        membershipId: 13,
        storeId: 4,
        status: "revoked",
      }),
    ];
    const { service } = createHarness(records);

    const dto = await service.getCurrentAccess(principal());
    expect(dto.memberships).toHaveLength(1);
    expect(dto.memberships[0]).toMatchObject({
      membershipId: 12,
      role: "manager",
      store: { id: 3, name: "Mumbai Central", slug: "mumbai-central" },
    });
    expect(dto.memberships[0].permissions).toContain("store.staff.manage");
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("tokenVersion");
    expect(serialized).not.toContain("actor@example.com");
    expect(serialized).not.toContain("storeIsActive");
    expect(serialized).not.toContain('"status"');

    const customerHarness = createHarness([]);
    await expect(customerHarness.service.getCurrentAccess(principal())).resolves.toEqual({
      platformRole: "user",
      memberships: [],
    });
  });

  it.each([
    ["finance_manager", "finance.ledger.post", "payroll.read"],
    ["payroll_manager", "payroll.pay", "finance.overview.read"],
  ] as const)(
    "returns the least-privilege permission DTO for %s",
    async (role, allowedPermission, deniedPermission) => {
      const { service } = createHarness([membership(role)]);

      const dto = await service.getCurrentAccess(principal());

      expect(dto.memberships[0]).toMatchObject({ role });
      expect(dto.memberships[0].permissions).toContain(allowedPermission);
      expect(dto.memberships[0].permissions).not.toContain(deniedPermission);
    }
  );

  it("returns a platform-wide marker without materializing memberships for admin", async () => {
    const { service, repository } = createHarness([membership()]);

    await expect(service.getCurrentAccess(principal("admin"))).resolves.toEqual({
      platformRole: "admin",
      platformAccess: "all",
      memberships: [],
    });
    expect(repository.listMemberships).not.toHaveBeenCalled();
  });
});
