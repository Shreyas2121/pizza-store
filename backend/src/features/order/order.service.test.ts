import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { AppError } from "../../utils/error";
import type { AuthPrincipal } from "../auth/auth.types";
import { AuthorizationService } from "../access/access.service";
import type { AccessRepository, MembershipAccessRecord } from "../access/access.types";
import type { AuditWriter, WriteAuditInput } from "../audit/audit.types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import { OrderService } from "./order.service";

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

const store2ManagerActor: AuthPrincipal = {
  userId: 40,
  email: "store2manager@example.com",
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
    storeId: 2,
    role: "manager",
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

  const orderService = new OrderService(authService, auditService);

  return {
    orderService,
    authService,
    auditService,
    writtenAudits,
    accessRepo,
  };
};

describe("OrderService unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("createOrder (COD)", () => {
    it("builds quote, creates payment & order, deducts COD stock atomically, and clears cart", async () => {
      const { orderService } = createTestHarness();

      const mockQuote = {
        cart: { storeId: 1, items: [] },
        totalPaise: 50000,
        totalRupees: 500,
        stockAllocations: [
          {
            storeProductId: 10,
            productId: 1,
            productName: "Margherita",
            demandedQuantity: 2,
            isTracked: true,
            onHandQuantity: 10,
            reservedQuantity: 0,
            availableQuantity: 10,
            lowStockThreshold: 5,
          },
        ],
        coupon: null,
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb({} as any)
      );
      vi.spyOn(checkoutService, "buildQuote").mockResolvedValue(mockQuote as any);
      vi.spyOn(paymentService, "createPayment").mockResolvedValue({ id: 100 } as any);
      vi.spyOn(checkoutService, "createOrderSnapshot").mockResolvedValue({
        id: 42,
        storeId: 1,
        grandTotalPaise: 50_000,
      } as any);
      vi.spyOn(inventoryService, "deductStockForCod").mockResolvedValue([
        {
          storeId: 1,
          storeProductId: 10,
          productId: 1,
          productName: "Margherita",
          currentQuantity: 8,
          threshold: 5,
          severity: "low_stock",
        },
      ]);
      vi.spyOn(cartService, "clearCart").mockResolvedValue(undefined as any);

      const result = await orderService.createOrder({
        userId: 7,
        addressId: 1,
      });

      expect(result).toEqual({
        id: 42,
        storeId: 1,
        paymentId: 100,
        totalPrice: 500,
        lowStockAlerts: expect.any(Array),
      });

      expect(inventoryService.deductStockForCod).toHaveBeenCalledWith(
        {
          orderId: 42,
          storeId: 1,
          allocations: mockQuote.stockAllocations,
        },
        expect.anything()
      );
      expect(cartService.clearCart).toHaveBeenCalledWith(7, expect.anything());
    });
  });

  describe("customer order reads", () => {
    it("maps list totals from exact paise snapshots", async () => {
      const { orderService } = createTestHarness();
      vi.spyOn(db.query.ordersTable, "findMany").mockResolvedValue([
        {
          id: 1,
          userId: 7,
          discountPaise: 2_000,
          grandTotalPaise: 18_000,
          discountAmount: 999,
          totalPrice: 999,
        },
      ] as any);

      await expect(orderService.getOrders(7)).resolves.toEqual([
        expect.objectContaining({
          id: 1,
          discountAmount: 20,
          totalPrice: 180,
        }),
      ]);
    });

    it("maps detail names and prices from line/customization snapshots", async () => {
      const { orderService } = createTestHarness();
      vi.spyOn(db.query.ordersTable, "findFirst").mockResolvedValue({
        id: 1,
        userId: 7,
        discountPaise: 0,
        grandTotalPaise: 25_000,
        items: [
          {
            productName: "Snapshot Pizza",
            unitPricePaise: 25_000,
            product: { name: "Current Pizza" },
            orderItemCustomizations: [
              {
                customizationName: "Snapshot Cheese",
                pricePaise: 5_000,
                customizationOption: { name: "Current Cheese" },
              },
            ],
          },
        ],
      } as any);

      const order = await orderService.getOrderDetails(1);

      expect(order).toMatchObject({
        totalPrice: 250,
        items: [
          {
            price: 200,
            product: { name: "Snapshot Pizza" },
            orderItemCustomizations: [
              {
                price: 50,
                customizationOption: { name: "Snapshot Cheese" },
              },
            ],
          },
        ],
      });
    });
  });

  describe("getAdminOrders", () => {
    it("returns orders filtered by storeId and status", async () => {
      const { orderService } = createTestHarness();

      const mockOrders = [
        {
          id: 1,
          storeId: 1,
          status: "pending",
          discountPaise: 0,
          grandTotalPaise: 30_000,
        },
      ];

      vi.spyOn(db.query.ordersTable, "findMany").mockResolvedValue(mockOrders as any);

      const orders = await orderService.getAdminOrders({
        status: "pending",
        storeId: 1,
      });

      expect(orders).toEqual([
        expect.objectContaining({
          id: 1,
          discountAmount: 0,
          totalPrice: 300,
        }),
      ]);
    });

    it("returns global orders when storeId is omitted for platform admin", async () => {
      const { orderService } = createTestHarness();

      const mockOrders = [
        {
          id: 1,
          storeId: 1,
          status: "pending",
          discountPaise: 0,
          grandTotalPaise: 30_000,
        },
        {
          id: 2,
          storeId: 2,
          status: "pending",
          discountPaise: 0,
          grandTotalPaise: 45_000,
        },
      ];

      vi.spyOn(db.query.ordersTable, "findMany").mockResolvedValue(mockOrders as any);

      const orders = await orderService.getAdminOrders({
        status: "pending",
      });

      expect(orders).toHaveLength(2);
    });
  });

  describe("updateOrderStatus authorization & lifecycle", () => {
    it("authorizes manager on assigned store, updates status, and writes audit log", async () => {
      const { orderService, writtenAudits } = createTestHarness();

      const orderInDb = {
        id: 42,
        storeId: 1,
        userId: 7,
        status: "pending",
        paymentType: "razorpay",
        paymentId: 100,
        couponId: null,
      };

      const updatedOrder = {
        ...orderInDb,
        status: "preparing",
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([orderInDb]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([updatedOrder]),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      const result = await orderService.updateOrderStatus(
        42,
        "preparing",
        managerActor
      );

      expect(result.status).toBe("preparing");
      expect(writtenAudits).toHaveLength(1);
      expect(writtenAudits[0]).toMatchObject({
        storeId: 1,
        action: "order.status.updated",
        resourceType: "order",
        resourceId: 42,
        before: { status: "pending" },
        after: { status: "preparing" },
      });
    });

    it("authorizes operator on assigned store", async () => {
      const { orderService } = createTestHarness();

      const orderInDb = {
        id: 42,
        storeId: 1,
        userId: 7,
        status: "pending",
        paymentType: "razorpay",
        paymentId: 100,
        couponId: null,
      };

      const updatedOrder = {
        ...orderInDb,
        status: "preparing",
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([orderInDb]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([updatedOrder]),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      const result = await orderService.updateOrderStatus(
        42,
        "preparing",
        operatorActor
      );

      expect(result.status).toBe("preparing");
    });

    it("denies inventory staff from updating order status", async () => {
      const { orderService } = createTestHarness();

      const orderInDb = {
        id: 42,
        storeId: 1,
        userId: 7,
        status: "pending",
        paymentType: "cash",
        paymentId: 100,
        couponId: null,
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([orderInDb]),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      await expect(
        orderService.updateOrderStatus(42, "preparing", inventoryActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("denies manager from updating an order belonging to another store", async () => {
      const { orderService } = createTestHarness();

      // Order is for Store 1, but caller is manager of Store 2 only
      const orderInDb = {
        id: 42,
        storeId: 1,
        userId: 7,
        status: "pending",
        paymentType: "cash",
        paymentId: 100,
        couponId: null,
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([orderInDb]),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      await expect(
        orderService.updateOrderStatus(42, "preparing", store2ManagerActor)
      ).rejects.toMatchObject({
        status: 403,
        code: "PERMISSION_DENIED",
      });
    });

    it("locks order row, validates state transition, and restores stock on cancellation", async () => {
      const { orderService } = createTestHarness();

      const orderInDb = {
        id: 42,
        storeId: 1,
        status: "pending",
        couponId: null,
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([orderInDb]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 42,
                  status: "cancelled",
                },
              ]),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      vi.spyOn(inventoryService, "restoreStockForOrder").mockResolvedValue(
        undefined as any
      );

      const updated = await orderService.updateOrderStatus(42, "cancelled", adminActor);

      expect(updated.status).toBe("cancelled");
      expect(inventoryService.restoreStockForOrder).toHaveBeenCalledWith(
        { orderId: 42, createdBy: adminActor.userId },
        mockTx
      );
    });

    it("treats duplicate status update as a no-op", async () => {
      const { orderService } = createTestHarness();

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "cancelled",
                  },
                ]),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const restoreSpy = vi
        .spyOn(inventoryService, "restoreStockForOrder")
        .mockResolvedValue(undefined as any);

      const result = await orderService.updateOrderStatus(42, "cancelled", adminActor);

      expect(result).toEqual({ id: 42, storeId: 1, status: "cancelled" });
      expect(restoreSpy).not.toHaveBeenCalled();
    });

    it("marks the linked COD payment completed and sets timestamps when the order is delivered", async () => {
      const { orderService } = createTestHarness();

      const set = vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(
            "paidAt" in values
              ? [{ id: 100 }]
              : [{ id: 42, status: "delivered" }]
          ),
        })),
      }));
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "out_for_delivery",
                    paymentType: "cash",
                    paymentId: 100,
                    couponId: null,
                    deliveredAt: null,
                    recognizedAt: null,
                  },
                ]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({ set })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      const updated = await orderService.updateOrderStatus(42, "delivered", adminActor);

      expect(updated.status).toBe("delivered");
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          paidAt: expect.any(Date),
          paymentDate: expect.any(Date),
          failedAt: null,
          failureCode: null,
          failureDescription: null,
        })
      );
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "delivered",
          deliveredAt: expect.any(Date),
          recognizedAt: expect.any(Date),
        })
      );
    });

    it("does not complete COD payment when order transitions to out_for_delivery", async () => {
      const { orderService } = createTestHarness();

      const set = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 42, status: "out_for_delivery" },
          ]),
        })),
      }));
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "preparing",
                    paymentType: "cash",
                    paymentId: 100,
                    couponId: null,
                  },
                ]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({ set })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      const updated = await orderService.updateOrderStatus(42, "out_for_delivery", adminActor);

      expect(updated.status).toBe("out_for_delivery");
      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(set).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "out_for_delivery" })
      );
    });

    it("does not complete an online payment when its order is delivered", async () => {
      const { orderService } = createTestHarness();

      const set = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 42, status: "delivered" },
          ]),
        })),
      }));
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "out_for_delivery",
                    paymentType: "razorpay",
                    paymentId: 100,
                    couponId: null,
                  },
                ]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({ set })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      await orderService.updateOrderStatus(42, "delivered", adminActor);

      expect(mockTx.update).toHaveBeenCalledTimes(1);
      expect(set).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });

    it("rejects direct transition from preparing to delivered", async () => {
      const { orderService } = createTestHarness();

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "preparing",
                  },
                ]),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      await expect(
        orderService.updateOrderStatus(42, "delivered", adminActor)
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVALID_ORDER_STATUS_TRANSITION",
          status: 409,
        })
      );
    });

    it("rejects illegal state transition from delivered", async () => {
      const { orderService } = createTestHarness();

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "delivered",
                  },
                ]),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );

      await expect(
        orderService.updateOrderStatus(42, "cancelled", adminActor)
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVALID_ORDER_STATUS_TRANSITION",
          status: 409,
        })
      );
    });

    it("sets cancelledAt timestamp when order is cancelled", async () => {
      const { orderService } = createTestHarness();

      const set = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 42, status: "cancelled" },
          ]),
        })),
      }));
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    storeId: 1,
                    status: "out_for_delivery",
                    paymentType: "cash",
                    paymentId: 100,
                    couponId: null,
                    cancelledAt: null,
                  },
                ]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({ set })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      vi.spyOn(inventoryService, "restoreStockForOrder").mockResolvedValue(
        undefined as any
      );

      const updated = await orderService.updateOrderStatus(42, "cancelled", adminActor);

      expect(updated.status).toBe("cancelled");
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          cancelledAt: expect.any(Date),
        })
      );
    });
  });
});
