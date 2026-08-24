import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { AppError } from "../../utils/error";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import orderService from "./order.service";

describe("OrderService unit tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOrder (COD)", () => {
    it("builds quote, creates payment & order, deducts COD stock atomically, and clears cart", async () => {
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
        totalPrice: 500,
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

  describe("updateOrderStatus", () => {
    it("locks order row, validates state transition, and restores stock on cancellation", async () => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    status: "pending",
                    couponId: null,
                  },
                ]),
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

      const updated = await orderService.updateOrderStatus(42, "cancelled", 99);

      expect(updated.status).toBe("cancelled");
      expect(inventoryService.restoreStockForOrder).toHaveBeenCalledWith(
        { orderId: 42, createdBy: 99 },
        mockTx
      );
    });

    it("treats duplicate status update as a no-op", async () => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
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

      const result = await orderService.updateOrderStatus(42, "cancelled");

      expect(result).toEqual({ id: 42, status: "cancelled" });
      expect(restoreSpy).not.toHaveBeenCalled();
    });

    it("rejects illegal state transition", async () => {
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  {
                    id: 42,
                    status: "delievered",
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
        orderService.updateOrderStatus(42, "cancelled")
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVALID_ORDER_STATUS_TRANSITION",
          status: 409,
        })
      );
    });
  });
});
