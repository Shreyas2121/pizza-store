import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inventoryMovementsTable,
  inventoryReservationsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import { InventoryService } from "./inventory.service";

describe("InventoryService unit tests", () => {
  const service = new InventoryService(undefined, { write: vi.fn() });
  const inventoryActor = {
    userId: 99,
    email: "admin@example.com",
    platformRole: "admin" as const,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("lockStoreProducts", () => {
    it("locks requested store-product rows in ascending ID order with FOR UPDATE", async () => {
      const forSpy = vi.fn().mockResolvedValue([]);
      const orderBySpy = vi.fn().mockReturnValue({ for: forSpy });
      const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
      const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
      const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });

      const mockTx = { select: selectSpy } as unknown as TransactionType;

      await service.lockStoreProducts(1, [5, 3, 5], mockTx);

      expect(selectSpy).toHaveBeenCalled();
      expect(fromSpy).toHaveBeenCalledWith(storeProductsTable);
      expect(orderBySpy).toHaveBeenCalled();
      expect(forSpy).toHaveBeenCalledWith("update");
    });
  });

  describe("deductStockForCod", () => {
    it("deducts on-hand quantity, creates sale movements, and never modifies manual availability", async () => {
      const updatedRows: any[] = [];
      const insertedMovements: any[] = [];

      const mockTx = {
        update: vi.fn((table: any) => ({
          set: vi.fn((values: any) => {
            updatedRows.push({ table, values });
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: any) => {
            insertedMovements.push({ table, values });
            return Promise.resolve();
          }),
        })),
      } as unknown as TransactionType;

      const alerts = await service.deductStockForCod(
        {
          orderId: 42,
          storeId: 1,
          allocations: [
            {
              storeProductId: 10,
              productId: 1,
              productName: "Margherita",
              demandedQuantity: 2,
              isTracked: true,
              onHandQuantity: 10,
              reservedQuantity: 0,
              availableQuantity: 10,
              lowStockThreshold: 8,
            },
            {
              storeProductId: 11,
              productId: 2,
              productName: "Garlic Bread",
              demandedQuantity: 3,
              isTracked: false,
              onHandQuantity: null,
              reservedQuantity: 0,
              availableQuantity: null,
              lowStockThreshold: 5,
            },
          ],
        },
        mockTx
      );

      // Only tracked product was updated
      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0].values).toEqual({
        onHandQuantity: 8,
        updatedAt: expect.any(Date),
      });
      // Verify manual availability is NOT modified
      expect(updatedRows[0].values).not.toHaveProperty("isAvailable");
      expect(updatedRows[0].values).not.toHaveProperty("lastRestockedAt");

      // Verify movement creation
      expect(insertedMovements).toHaveLength(1);
      expect(insertedMovements[0].values).toEqual({
        storeProductId: 10,
        changeType: "sale",
        quantityChange: -2,
        previousQuantity: 10,
        newQuantity: 8,
        orderId: 42,
        idempotencyKey: "sale:42:10",
        createdBy: null,
      });

      // Crossing: 10 was > 8, new available 8 <= 8 -> low_stock alert emitted
      expect(alerts).toEqual([
        {
          storeId: 1,
          storeProductId: 10,
          productId: 1,
          productName: "Margherita",
          currentQuantity: 8,
          threshold: 8,
          severity: "low_stock",
        },
      ]);
    });
  });

  describe("restoreStockForOrder", () => {
    it("restores stock from sale movements with cancellation idempotency key", async () => {
      const updatedRows: any[] = [];
      const insertedMovements: any[] = [];

      const mockTx = {
        update: vi.fn((table: any) => ({
          set: vi.fn((values: any) => {
            updatedRows.push({ table, values });
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: any) => {
            insertedMovements.push({ table, values });
            return Promise.resolve();
          }),
        })),
        select: vi.fn((fields?: any) => ({
          from: vi.fn((table: any) => ({
            where: vi.fn((condition: any) => {
              // 1. Existing sale movements for order 42
              if (table === inventoryMovementsTable && !fields) {
                return Promise.resolve([
                  {
                    id: 1,
                    storeProductId: 10,
                    changeType: "sale",
                    quantityChange: -3,
                    orderId: 42,
                  },
                ]);
              }
              // 2. Existing cancellations (none yet)
              if (table === inventoryMovementsTable && fields) {
                return Promise.resolve([]);
              }
              // 3. Locked store products
              if (table === storeProductsTable) {
                return {
                  orderBy: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        id: 10,
                        productId: 1,
                        onHandQuantity: 5,
                      },
                    ]),
                  }),
                };
              }
              return Promise.resolve([]);
            }),
          })),
        })),
      } as unknown as TransactionType;

      await service.restoreStockForOrder(
        { orderId: 42, createdBy: 99 },
        mockTx
      );

      // On-hand was 5, restores 3 -> new 8
      expect(updatedRows).toHaveLength(2); // 1 for reservations release + 1 for storeProductsTable
      const storeProductUpdate = updatedRows.find(
        (u) => u.table === storeProductsTable
      );
      expect(storeProductUpdate.values).toEqual({
        onHandQuantity: 8,
        updatedAt: expect.any(Date),
      });

      expect(insertedMovements).toHaveLength(1);
      expect(insertedMovements[0].values).toEqual({
        storeProductId: 10,
        changeType: "cancellation",
        quantityChange: 3,
        previousQuantity: 5,
        newQuantity: 8,
        orderId: 42,
        idempotencyKey: "cancellation:42:10",
        createdBy: 99,
        reason: "Order cancelled",
      });
    });

    it("skips restoration if order has already been cancelled (idempotent)", async () => {
      const updatedRows: any[] = [];
      const insertedMovements: any[] = [];

      const mockTx = {
        update: vi.fn(() => ({
          set: vi.fn((values: any) => {
            updatedRows.push(values);
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((values: any) => {
            insertedMovements.push(values);
            return Promise.resolve();
          }),
        })),
        select: vi.fn((fields?: any) => ({
          from: vi.fn((table: any) => ({
            where: vi.fn(() => {
              if (table === inventoryMovementsTable && !fields) {
                // Sale movements
                return Promise.resolve([
                  {
                    id: 1,
                    storeProductId: 10,
                    changeType: "sale",
                    quantityChange: -3,
                    orderId: 42,
                  },
                ]);
              }
              if (table === inventoryMovementsTable && fields) {
                // Already cancelled
                return Promise.resolve([{ storeProductId: 10 }]);
              }
              return Promise.resolve([]);
            }),
          })),
        })),
      } as unknown as TransactionType;

      await service.restoreStockForOrder({ orderId: 42 }, mockTx);

      // No new stock movements or on-hand updates
      expect(insertedMovements).toHaveLength(0);
    });
  });

  describe("reserveStockForOrder", () => {
    it("creates reservations without decrementing on-hand quantity", async () => {
      const insertedReservations: any[] = [];
      const mockTx = {
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: any) => {
            insertedReservations.push({ table, values });
            return Promise.resolve();
          }),
        })),
      } as unknown as TransactionType;

      const alerts = await service.reserveStockForOrder(
        {
          orderId: 42,
          storeId: 1,
          allocations: [
            {
              storeProductId: 10,
              productId: 1,
              productName: "Margherita",
              demandedQuantity: 2,
              isTracked: true,
              onHandQuantity: 10,
              reservedQuantity: 0,
              availableQuantity: 10,
              lowStockThreshold: 8,
            },
            {
              storeProductId: 11,
              productId: 2,
              productName: "Garlic Bread",
              demandedQuantity: 1,
              isTracked: false,
              onHandQuantity: null,
              reservedQuantity: 0,
              availableQuantity: null,
              lowStockThreshold: 5,
            },
          ],
        },
        mockTx
      );

      expect(insertedReservations).toHaveLength(1);
      expect(insertedReservations[0].values).toEqual({
        orderId: 42,
        storeProductId: 10,
        quantity: 2,
        status: "reserved",
        expiresAt: expect.any(Date),
      });

      // Emits downward alert: availableBefore 10 > 8, availableAfter 8 <= 8
      expect(alerts).toEqual([
        {
          storeId: 1,
          storeProductId: 10,
          productId: 1,
          productName: "Margherita",
          currentQuantity: 8,
          threshold: 8,
          severity: "low_stock",
        },
      ]);
    });
  });

  describe("consumeReservationsForOrder", () => {
    it("consumes active reservations, decrements on-hand, and inserts sale movements", async () => {
      const updatedRows: any[] = [];
      const insertedMovements: any[] = [];

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn((table: any) => ({
            where: vi.fn((condition: any) => {
              if (table === inventoryReservationsTable) {
                return {
                  orderBy: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        id: 1,
                        orderId: 42,
                        storeProductId: 10,
                        quantity: 2,
                        status: "reserved",
                      },
                    ]),
                  }),
                  // initial select without orderBy
                  then: (resolve: any) =>
                    resolve([
                      {
                        id: 1,
                        orderId: 42,
                        storeProductId: 10,
                        quantity: 2,
                        status: "reserved",
                      },
                    ]),
                };
              }
              if (table === storeProductsTable) {
                return {
                  orderBy: vi.fn().mockReturnValue({
                    for: vi.fn().mockResolvedValue([
                      {
                        id: 10,
                        productId: 1,
                        onHandQuantity: 10,
                      },
                    ]),
                  }),
                };
              }
              return Promise.resolve([]);
            }),
          })),
        })),
        update: vi.fn((table: any) => ({
          set: vi.fn((values: any) => {
            updatedRows.push({ table, values });
            return {
              where: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: any) => {
            insertedMovements.push({ table, values });
            return Promise.resolve();
          }),
        })),
      } as unknown as TransactionType;

      const result = await service.consumeReservationsForOrder(42, mockTx);

      expect(result.consumedCount).toBe(1);
      expect(result.alreadyConsumed).toBe(false);

      const reservationUpdate = updatedRows.find(
        (u) => u.table === inventoryReservationsTable
      );
      expect(reservationUpdate.values.status).toBe("consumed");

      const storeProductUpdate = updatedRows.find(
        (u) => u.table === storeProductsTable
      );
      expect(storeProductUpdate.values.onHandQuantity).toBe(8);

      expect(insertedMovements).toHaveLength(1);
      expect(insertedMovements[0].values).toEqual({
        storeProductId: 10,
        changeType: "sale",
        quantityChange: -2,
        previousQuantity: 10,
        newQuantity: 8,
        orderId: 42,
        idempotencyKey: "sale:42:10",
        createdBy: null,
      });
    });

    it("throws INVENTORY_RESERVATIONS_RELEASED if any reservation was released", async () => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([
              {
                id: 1,
                orderId: 42,
                storeProductId: 10,
                quantity: 2,
                status: "released",
              },
            ]),
          })),
        })),
      } as unknown as TransactionType;

      await expect(
        service.consumeReservationsForOrder(42, mockTx)
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVENTORY_RESERVATIONS_RELEASED",
          status: 409,
        })
      );
    });
  });

  describe("bulkRestockProducts", () => {
    const selectProducts = (products: Array<{ id: number; productName: string }>) =>
      vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(products),
        })),
      }));

    it("re-authorizes inside the write transaction and attributes movement and audit actors", async () => {
      const requireStorePermission = vi.fn().mockResolvedValue({ access: "membership" });
      const write = vi.fn().mockResolvedValue(undefined);
      const securedService = new InventoryService(
        { requireStorePermission } as any,
        { write }
      );
      const inserted: Array<{ table: unknown; values: unknown }> = [];
      const mockTx = {
        select: selectProducts([{ id: 1, productName: "Pizza" }]),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
        insert: vi.fn((table: unknown) => ({
          values: vi.fn((values: unknown) => {
            inserted.push({ table, values });
            return Promise.resolve();
          }),
        })),
      } as unknown as TransactionType;
      vi.spyOn(securedService, "lockStoreProducts").mockResolvedValue([
        { id: 10, storeId: 1, productId: 1, onHandQuantity: 5 },
      ] as any);
      const actor = { userId: 77, email: "staff@example.com", platformRole: "user" as const };

      await securedService.bulkRestockProducts(
        1,
        [{ productId: 1, quantityAdded: 2 }],
        actor,
        mockTx
      );

      expect(requireStorePermission).toHaveBeenCalledWith({
        principal: actor,
        storeId: 1,
        permission: "inventory.restock",
        tx: mockTx,
        lockMembership: true,
      });
      expect(inserted[0].values).toEqual([
        expect.objectContaining({ createdBy: 77 }),
      ]);
      expect(write).toHaveBeenCalledWith(expect.objectContaining({
        tx: mockTx,
        actor,
        storeId: 1,
        action: "inventory.bulk_restocked",
        metadata: { productCount: 1 },
      }));
    });

    it("propagates audit failures so the surrounding transaction can roll back", async () => {
      const auditFailure = new Error("audit unavailable");
      const securedService = new InventoryService(
        { requireStorePermission: vi.fn().mockResolvedValue({}) } as any,
        { write: vi.fn().mockRejectedValue(auditFailure) }
      );
      const mockTx = {
        select: selectProducts([{ id: 1, productName: "Pizza" }]),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      } as unknown as TransactionType;
      vi.spyOn(securedService, "lockStoreProducts").mockResolvedValue([
        { id: 10, storeId: 1, productId: 1, onHandQuantity: 5 },
      ] as any);

      await expect(securedService.bulkRestockProducts(
        1,
        [{ productId: 1, quantityAdded: 2 }],
        { userId: 77, email: "staff@example.com", platformRole: "user" },
        mockTx
      )).rejects.toBe(auditFailure);
    });

    it("uses the shared lock helper and applies all prepared changes", async () => {
      const updates: Array<Record<string, unknown>> = [];
      const insertedMovements: unknown[] = [];
      const mockTx = {
        select: selectProducts([
          { id: 1, productName: "Pizza" },
          { id: 2, productName: "Pasta" },
        ]),
        update: vi.fn(() => ({
          set: vi.fn((values: Record<string, unknown>) => {
            updates.push(values);
            return { where: vi.fn().mockResolvedValue([]) };
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((values: unknown) => {
            insertedMovements.push(values);
            return Promise.resolve();
          }),
        })),
      } as unknown as TransactionType;
      const lockSpy = vi
        .spyOn(service, "lockStoreProducts")
        .mockResolvedValue([
          { id: 10, storeId: 1, productId: 1, onHandQuantity: 5 },
          { id: 20, storeId: 1, productId: 2, onHandQuantity: 7 },
        ] as any);

      const result = await service.bulkRestockProducts(
        1,
        [
          { productId: 2, quantityAdded: 4, reason: "Delivery" },
          { productId: 1, quantityAdded: 3 },
        ],
        inventoryActor,
        mockTx
      );

      expect(lockSpy).toHaveBeenCalledWith(1, [2, 1], mockTx);
      expect(updates).toEqual([
        {
          onHandQuantity: 8,
          lastRestockedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        {
          onHandQuantity: 11,
          lastRestockedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]);
      expect(insertedMovements).toEqual([
        [
          {
            storeProductId: 10,
            changeType: "restock",
            quantityChange: 3,
            previousQuantity: 5,
            newQuantity: 8,
            reason: null,
            createdBy: 99,
          },
          {
            storeProductId: 20,
            changeType: "restock",
            quantityChange: 4,
            previousQuantity: 7,
            newQuantity: 11,
            reason: "Delivery",
            createdBy: 99,
          },
        ],
      ]);
      expect(result.updatedCount).toBe(2);
      expect(result.items).toEqual([
        expect.objectContaining({ productId: 1, productName: "Pizza" }),
        expect.objectContaining({ productId: 2, productName: "Pasta" }),
      ]);
    });

    it("validates every mapping before performing any write", async () => {
      const mockTx = {
        update: vi.fn(),
        insert: vi.fn(),
      } as unknown as TransactionType;
      vi.spyOn(service, "lockStoreProducts").mockResolvedValue([
        { id: 10, storeId: 1, productId: 1, onHandQuantity: 5 },
      ] as any);

      await expect(
        service.bulkRestockProducts(
          1,
          [
            { productId: 1, quantityAdded: 2 },
            { productId: 2, quantityAdded: 2 },
          ],
          inventoryActor,
          mockTx
        )
      ).rejects.toMatchObject({
        code: "STORE_PRODUCT_NOT_FOUND",
        data: { productIds: [2] },
      });
      expect(mockTx.update).not.toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled();
    });

    it("rejects duplicate IDs and batches over 50 before locking", async () => {
      const lockSpy = vi.spyOn(service, "lockStoreProducts");
      const mockTx = {} as TransactionType;

      await expect(
        service.bulkRestockProducts(
          1,
          [
            { productId: 1, quantityAdded: 1 },
            { productId: 1, quantityAdded: 2 },
          ],
          inventoryActor,
          mockTx
        )
      ).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT_IDS" });
      await expect(
        service.bulkRestockProducts(
          1,
          Array.from({ length: 51 }, (_, index) => ({
            productId: index + 1,
            quantityAdded: 1,
          })),
          inventoryActor,
          mockTx
        )
      ).rejects.toMatchObject({ code: "BULK_RESTOCK_LIMIT_EXCEEDED" });
      expect(lockSpy).not.toHaveBeenCalled();
    });
  });
});
