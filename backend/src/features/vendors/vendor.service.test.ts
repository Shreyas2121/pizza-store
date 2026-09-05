import { beforeEach, describe, expect, it, vi } from "vitest";
import authorizationService from "../access/access.service";
import auditService from "../audit/audit.service";
import { VendorService } from "./vendor.service";

const admin = { userId: 9, email: "owner@example.com", platformRole: "admin" as const, tokenVersion: 1 };
const storeCategory = { id: 4, storeId: 1, parentId: null, name: "Utilities", normalizedName: "utilities", classification: "variable", ledgerAccountId: null, isActive: true, createdBy: 9, updatedBy: 9, createdAt: new Date(), updatedAt: new Date() } as const;

describe("vendor and category service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditService, "write").mockResolvedValue();
  });

  it("allows only the platform owner to create platform-scoped masters", async () => {
    const repository = {
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      createVendor: vi.fn().mockResolvedValue({ id: 1, storeId: null, name: "National Foods", normalizedName: "national foods", paymentTermsDays: 30, isActive: true }),
    };
    const service = new VendorService(repository as never);
    await expect(service.createVendor({ ...admin, platformRole: "user" }, { name: "National Foods", paymentTermsDays: 30 }))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(service.createVendor(admin, { name: "National Foods", paymentTermsDays: 30 }))
      .resolves.toMatchObject({ storeId: null });
    expect(repository.createVendor).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: "National Foods" }), 9);
  });

  it("rejects a category parent from another scope", async () => {
    vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.expenses.create" });
    const repository = {
      findStore: vi.fn().mockResolvedValue({ id: 1 }),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      findCategory: vi.fn().mockResolvedValue({ ...storeCategory, storeId: 2 }),
      createCategory: vi.fn(),
    };
    const service = new VendorService(repository as never);
    await expect(service.createCategory(admin, { storeId: 1, parentId: 4, name: "Electricity", classification: "variable" }))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(repository.createCategory).not.toHaveBeenCalled();
  });

  it("prevents hierarchy cycles when a category is reparented", async () => {
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.expenses.create" });
    const repository = {
      findCategory: vi.fn()
        .mockResolvedValueOnce(storeCategory)
        .mockResolvedValueOnce({ ...storeCategory, id: 7, parentId: 4 }),
      lockCategory: vi.fn().mockResolvedValue(storeCategory),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      updateCategory: vi.fn(),
    };
    const service = new VendorService(repository as never);
    await expect(service.updateCategory(admin, 4, { parentId: 7 }))
      .rejects.toMatchObject({ code: "CATEGORY_HIERARCHY_CYCLE" });
    expect(repository.updateCategory).not.toHaveBeenCalled();
  });

  it("soft-deactivation preserves a parent while active children exist", async () => {
    vi.spyOn(authorizationService, "requireResourceStorePermission").mockResolvedValue({ access: "platform", userId: 9, storeId: 1, permission: "finance.expenses.create" });
    const repository = {
      findCategory: vi.fn().mockResolvedValue(storeCategory),
      lockCategory: vi.fn().mockResolvedValue(storeCategory),
      transaction: (work: (tx: never) => Promise<unknown>) => work({} as never),
      hasActiveChildren: vi.fn().mockResolvedValue(true),
      updateCategory: vi.fn(),
    };
    const service = new VendorService(repository as never);
    await expect(service.updateCategory(admin, 4, { isActive: false }))
      .rejects.toMatchObject({ code: "ACTIVE_CATEGORY_CHILDREN" });
    expect(repository.updateCategory).not.toHaveBeenCalled();
  });
});
