import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import {
  deliveryZonesTable,
  inventoryMovementsTable,
  inventoryReservationsTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import type { AuthPrincipal } from "../auth/auth.types";
import { AuthorizationService } from "../access/access.service";
import type { AccessRepository, MembershipAccessRecord } from "../access/access.types";
import type { AuditWriter, WriteAuditInput } from "../audit/audit.types";
import { StoreService } from "./stores.service";

const adminActor: AuthPrincipal = {
  userId: 1,
  email: "admin@example.com",
  platformRole: "admin",
  tokenVersion: 0,
};

const managerActor: AuthPrincipal = {
  userId: 10,
  email: "manager@example.com",
  platformRole: "user",
  tokenVersion: 0,
};

const operatorActor: AuthPrincipal = {
  userId: 20,
  email: "operator@example.com",
  platformRole: "user",
  tokenVersion: 0,
};

const inventoryActor: AuthPrincipal = {
  userId: 30,
  email: "inventory@example.com",
  platformRole: "user",
  tokenVersion: 0,
};

const multiStaffActor: AuthPrincipal = {
  userId: 40,
  email: "multistaff@example.com",
  platformRole: "user",
  tokenVersion: 0,
};

const customerActor: AuthPrincipal = {
  userId: 99,
  email: "customer@example.com",
  platformRole: "user",
  tokenVersion: 0,
};

const memberships: MembershipAccessRecord[] = [
  {
    membershipId: 101,
    userId: 10,
    storeId: 1,
    role: "manager",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 102,
    userId: 20,
    storeId: 1,
    role: "operator",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 103,
    userId: 30,
    storeId: 1,
    role: "inventory_staff",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 104,
    userId: 40,
    storeId: 1,
    role: "manager",
    status: "active",
    storeIsActive: true,
    storeName: "Store 1",
    storeSlug: "store-1",
  },
  {
    membershipId: 105,
    userId: 40,
    storeId: 2,
    role: "inventory_staff",
    status: "active",
    storeIsActive: true,
    storeName: "Store 2",
    storeSlug: "store-2",
  },
];

const createTestHarness = () => {
  const accessRepo: AccessRepository = {
    findMembership: vi.fn(async ({ userId, storeId }) =>
      memberships.find(
        (m) => m.userId === userId && m.storeId === storeId
      )
    ),
    listMemberships: vi.fn(async ({ userId }) =>
      memberships.filter((m) => m.userId === userId)
    ),
  };

  const authService = new AuthorizationService(accessRepo, { warn: vi.fn() });
  const writtenAudits: WriteAuditInput[] = [];
  const auditService: AuditWriter = {
    write: vi.fn(async (input: WriteAuditInput) => {
      writtenAudits.push(input);
    }),
  };

  const storeService = new StoreService(authService, auditService);

  return {
    storeService,
    authService,
    auditService,
    writtenAudits,
    accessRepo,
  };
};

describe("StoreService — Authorization & Scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("getStores & getStoresSelect scoping", () => {
    it("allows platform admin to list all stores without membership filters", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 3 }]),
        }),
      } as any);

      vi.spyOn(db.query.storesTable, "findMany").mockResolvedValue([
        { id: 1, name: "Store 1" },
        { id: 2, name: "Store 2" },
        { id: 3, name: "Store 3" },
      ] as any);

      const result = await storeService.getStores({ principal: adminActor });
      expect(result.stores).toHaveLength(3);
      expect(result.meta.total).toBe(3);
    });

    it("scopes store list to assigned stores for staff members", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }]),
        }),
      } as any);

      vi.spyOn(db.query.storesTable, "findMany").mockResolvedValue([
        { id: 1, name: "Store 1" },
      ] as any);

      const result = await storeService.getStores({ principal: managerActor });
      expect(result.stores).toHaveLength(1);
    });

    it("allows multi-store staff to see all assigned stores", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(db, "select").mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 2 }]),
        }),
      } as any);

      vi.spyOn(db.query.storesTable, "findMany").mockResolvedValue([
        { id: 1, name: "Store 1" },
        { id: 2, name: "Store 2" },
      ] as any);

      const result = await storeService.getStores({ principal: multiStaffActor });
      expect(result.stores).toHaveLength(2);
    });

    it("denies store list access to ordinary users with no memberships", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.getStores({ principal: customerActor })
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("scopes getStoresSelect to active assigned stores for staff", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(db.query.storesTable, "findMany").mockResolvedValue([
        { id: 1, name: "Store 1", city: "Mumbai", pincode: "400001" },
      ] as any);

      const selectOptions = await storeService.getStoresSelect(operatorActor);
      expect(selectOptions).toEqual([
        { value: "1", label: "Store 1 (Mumbai - 400001)" },
      ]);
    });

    it("denies getStoresSelect to ordinary users with no memberships", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.getStoresSelect(customerActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });
  });

  describe("Platform Store Create & Delete", () => {
    it("allows platform admin to create a new store", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(storeService, "getStoreBySlug").mockResolvedValue(undefined as any);
      vi.spyOn(db, "insert").mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: 10, name: "New Store", slug: "new-store" },
          ]),
        }),
      } as any);

      const result = await storeService.createStore(
        {
          name: "New Store",
          address: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          phone: "9999999999",
          opensAt: "09:00",
          closesAt: "22:00",
        },
        adminActor
      );

      expect(result).toMatchObject({ id: 10, slug: "new-store" });
    });

    it("denies non-admin staff from creating a store", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.createStore(
          {
            name: "Hacked Store",
            address: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            phone: "9999999999",
            opensAt: "09:00",
            closesAt: "22:00",
          },
          managerActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("allows platform admin to delete/deactivate a store", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(storeService, "getStoreById").mockResolvedValue({
        id: 1,
        name: "Store 1",
      } as any);
      vi.spyOn(db, "update").mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: 1, isActive: false },
            ]),
          }),
        }),
      } as any);

      const result = await storeService.deleteStore(1, { permanent: false }, adminActor);
      expect(result.message).toBe("Store deactivated successfully");
    });

    it("denies non-admin staff from deleting/deactivating a store", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.deleteStore(1, { permanent: false }, managerActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });
  });

  describe("Store Profile Updates (updateStore)", () => {
    it("allows store manager to update allow-listed profile fields and records audit log", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const existingStore = {
        id: 1,
        name: "Store 1",
        address: "Old Address",
        city: "Mumbai",
        state: "MH",
        pincode: "400001",
        phone: "9876543210",
        email: "store1@example.com",
        opensAt: "09:00",
        closesAt: "22:00",
        latitude: null,
        longitude: null,
        slug: "store-1",
        isActive: true,
      };

      const updatedStore = {
        ...existingStore,
        address: "New Address 456",
        phone: "9123456789",
      };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existingStore]),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedStore]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      const result = await storeService.updateStore(
        1,
        { address: "New Address 456", phone: "9123456789" },
        managerActor
      );

      expect(result.address).toBe("New Address 456");
      expect(writtenAudits).toHaveLength(1);
      expect(writtenAudits[0]).toMatchObject({
        storeId: 1,
        action: "store.profile.updated",
        resourceType: "store",
        resourceId: 1,
        before: expect.objectContaining({ address: "Old Address" }),
        after: expect.objectContaining({ address: "New Address 456" }),
      });
    });

    it("rejects store manager attempting to modify platform-controlled fields (slug, isActive)", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.updateStore(
          1,
          { slug: "new-custom-slug" },
          managerActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      await expect(
        storeService.updateStore(
          1,
          { isActive: false },
          managerActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("denies manager from updating another store", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.updateStore(
          2, // Store 2 (manager only has Store 1)
          { name: "Attempted Update" },
          managerActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("denies operator and inventory staff from updating store profile", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.updateStore(1, { name: "Operator Edit" }, operatorActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      await expect(
        storeService.updateStore(1, { name: "Inventory Edit" }, inventoryActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });
  });

  describe("Store Products — Role & Field-Level Permissions", () => {
    it("allows manager, operator, and inventory staff to read store products", async () => {
      const { storeService } = createTestHarness();

      vi.spyOn(storeService, "getStoreById").mockResolvedValue({ id: 1 } as any);
      vi.spyOn(db, "select").mockImplementation((fields?: any) => {
        if (fields && fields.storeProductId) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  as: vi.fn().mockReturnValue({
                    storeProductId: "store_product_id",
                    reservedQuantity: "reserved_quantity",
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: 50,
                      storeId: 1,
                      productId: 1,
                      price: 250,
                      isAvailable: true,
                      onHandQuantity: 20,
                      lowStockThreshold: 5,
                      reservedQuantity: 2,
                      product: { id: 1, name: "Pizza" },
                    },
                  ]),
                }),
              }),
            }),
          }),
        } as any;
      });

      const asManager = await storeService.getStoreProducts(1, managerActor);
      expect(asManager).toHaveLength(1);

      const asOperator = await storeService.getStoreProducts(1, operatorActor);
      expect(asOperator).toHaveLength(1);

      const asInventory = await storeService.getStoreProducts(1, inventoryActor);
      expect(asInventory).toHaveLength(1);
    });

    it("denies cross-store read of store products", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.getStoreProducts(2, managerActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("allows manager to map products and denies operator/inventory staff", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table: any) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === storesTable) {
                return {
                  for: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ id: 1 }]),
                  }),
                };
              }
              if (table === productsTable) {
                return Promise.resolve([{ id: 1 }]);
              }
              return Promise.resolve([]);
            }),
          })),
        })),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 101, storeId: 1, productId: 1, price: 299 }]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      // Manager succeeds
      const result = await storeService.mapStoreProducts(
        1,
        [{ productId: 1, price: 299, isAvailable: true }],
        managerActor
      );
      expect(result).toHaveLength(1);
      expect(writtenAudits).toHaveLength(1);
      expect(writtenAudits[0].action).toBe("store.products.mapped");

      // Operator is denied
      await expect(
        storeService.mapStoreProducts(
          1,
          [{ productId: 1, price: 299, isAvailable: true }],
          operatorActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      // Inventory staff is denied
      await expect(
        storeService.mapStoreProducts(
          1,
          [{ productId: 1, price: 299, isAvailable: true }],
          inventoryActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("allows inventory staff to update availability only, but denies price updates", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const existing = { id: 101, storeId: 1, productId: 1, price: 250, isAvailable: true };
      const updated = { ...existing, isAvailable: false };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existing]),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updated]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      // Inventory staff can update availability
      const result = await storeService.updateStoreProduct(
        1,
        1,
        { isAvailable: false },
        inventoryActor
      );
      expect(result.isAvailable).toBe(false);
      expect(writtenAudits).toHaveLength(1);
      expect(writtenAudits[0].action).toBe("store.product.updated");

      // Inventory staff CANNOT update price
      await expect(
        storeService.updateStoreProduct(
          1,
          1,
          { price: 300 },
          inventoryActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("requires both permissions for a mixed price + availability payload", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const existing = { id: 101, storeId: 1, productId: 1, price: 250, isAvailable: true };
      const updated = { ...existing, price: 320, isAvailable: false };

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([existing]),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updated]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      // Inventory staff has availability.update but lacks price.update -> must fail!
      await expect(
        storeService.updateStoreProduct(
          1,
          1,
          { price: 320, isAvailable: false },
          inventoryActor
        )
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      // Manager has both permissions -> succeeds
      const managerResult = await storeService.updateStoreProduct(
        1,
        1,
        { price: 320, isAvailable: false },
        managerActor
      );
      expect(managerResult.price).toBe(320);
      expect(managerResult.isAvailable).toBe(false);
      expect(writtenAudits).toHaveLength(1);
    });

    it("preserves soft-removal safeguard when unmapping product with inventory history", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const existing = { id: 101, storeId: 1, productId: 1, isAvailable: true };

      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === storeProductsTable) {
                return {
                  for: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([existing]),
                  }),
                };
              }
              if (table === inventoryMovementsTable) {
                return {
                  limit: vi.fn().mockResolvedValue([{ id: 999 }]), // Movement history exists!
                };
              }
              return {
                limit: vi.fn().mockResolvedValue([]),
              };
            }),
          })),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...existing, isAvailable: false }]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      const result = await storeService.deleteStoreProduct(1, 1, managerActor);
      expect(result.removal).toBe("soft");
      expect(result.isAvailable).toBe(false);
      expect(writtenAudits[0].metadata).toMatchObject({ removal: "soft" });
    });
  });

  describe("Delivery Zones Management", () => {
    it("allows manager to add delivery zones and writes audit log", async () => {
      const { storeService, writtenAudits } = createTestHarness();

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                { id: 1, storeId: 1, pincode: "400001" },
                { id: 2, storeId: 1, pincode: "400002" },
              ]),
            }),
          }),
        }),
      } as unknown as TransactionType;

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

      const result = await storeService.addDeliveryZones(
        1,
        ["400001", "400002"],
        managerActor
      );

      expect(result.addedCount).toBe(2);
      expect(writtenAudits).toHaveLength(1);
      expect(writtenAudits[0]).toMatchObject({
        action: "store.delivery_zones.added",
        resourceType: "delivery_zone",
        storeId: 1,
      });
    });

    it("denies operator and inventory staff from adding or deleting delivery zones", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.addDeliveryZones(1, ["400001"], operatorActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      await expect(
        storeService.addDeliveryZones(1, ["400001"], inventoryActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });

      await expect(
        storeService.deleteDeliveryZone(1, 10, operatorActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("denies manager from modifying delivery zones of another store", async () => {
      const { storeService } = createTestHarness();

      await expect(
        storeService.addDeliveryZones(2, ["400001"], managerActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });
  });
});
