import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import {
  inventoryMovementsTable,
  inventoryReservationsTable,
  ordersTable,
  paymentsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import * as razorpayConfig from "./razorpay.config";
import * as razorpayGateway from "./razorpay.gateway";
import paymentService from "./payment.service";

describe("PaymentService inventory reservation lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("initiation (findOrCreateLocalAttempt)", () => {
    it("reserves stock for tracked products without decrementing on-hand quantity", async () => {
      const mockQuote = {
        cart: { storeId: 1, store: { name: "Main Store" }, items: [] },
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

      vi.spyOn(checkoutService, "buildQuote").mockResolvedValue(mockQuote as any);
      vi.spyOn(paymentService, "createPayment").mockResolvedValue({
        id: 101,
        provider: "razorpay",
        status: "pending",
        amountPaise: 50000,
        currency: "INR",
        providerStatus: null,
        providerOrderId: null,
        failureCode: null,
        failureDescription: null,
      } as any);
      vi.spyOn(checkoutService, "createOrderSnapshot").mockResolvedValue({
        id: 42,
        userId: 7,
        storeId: 1,
        totalPrice: 500,
        couponId: null,
      } as any);
      const reserveSpy = vi
        .spyOn(inventoryService, "reserveStockForOrder")
        .mockResolvedValue([]);
      vi.spyOn(cartService, "clearCart").mockResolvedValue(undefined as any);
      vi.spyOn(razorpayConfig, "isRazorpayCheckoutEnabled").mockReturnValue(true);
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        webhookSecret: "whsec_test",
      });

      const attempt = await (paymentService as any).findOrCreateLocalAttempt({
        userId: 7,
        addressId: 1,
        clientRequestId: "req_12345",
      });

      expect(attempt.localOrderId).toBe(42);
      expect(attempt.localPaymentId).toBe(101);
      expect(reserveSpy).toHaveBeenCalledWith(
        {
          orderId: 42,
          storeId: 1,
          allocations: mockQuote.stockAllocations,
        },
        expect.anything()
      );
    });
  });

  describe("capture (finalizeCapturedPayment)", () => {
    it("consumes reservations and decrements on-hand quantity once", async () => {
      const mockRecord = {
        order: {
          id: 42,
          userId: 7,
          storeId: 1,
          totalPrice: 500,
          status: "awaiting_payment",
          couponId: null,
        },
        payment: {
          id: 101,
          provider: "razorpay",
          providerOrderId: "order_rzp_123",
          providerPaymentId: null,
          amountPaise: 50000,
          currency: "INR",
          status: "pending",
        },
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([mockRecord]),
                })),
              })),
            })),
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]), // no conflicting providerPaymentId
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const consumeSpy = vi
        .spyOn(inventoryService, "consumeReservationsForOrder")
        .mockResolvedValue({ consumedCount: 1, alreadyConsumed: false });

      const result = await paymentService.finalizeCapturedPayment({
        localOrderId: 42,
        providerOrderId: "order_rzp_123",
        providerPaymentId: "pay_rzp_456",
        amountPaise: 50000,
        currency: "INR",
        providerStatus: "captured",
        userId: 7,
      });

      expect(result.finalizedNow).toBe(true);
      expect(result.orderStatus).toBe("pending");
      expect(consumeSpy).toHaveBeenCalledWith(42, mockTx);
    });

    it("rejects with INVENTORY_RESERVATIONS_RELEASED if reservations were expired/released", async () => {
      const mockRecord = {
        order: {
          id: 42,
          userId: 7,
          storeId: 1,
          totalPrice: 500,
          status: "awaiting_payment",
          couponId: null,
        },
        payment: {
          id: 101,
          provider: "razorpay",
          providerOrderId: "order_rzp_123",
          providerPaymentId: null,
          amountPaise: 50000,
          currency: "INR",
          status: "pending",
        },
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([mockRecord]),
                })),
              })),
            })),
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      vi.spyOn(inventoryService, "consumeReservationsForOrder").mockRejectedValue(
        new AppError(
          "Payment reservations were released or expired",
          409,
          "INVENTORY_RESERVATIONS_RELEASED",
          { orderId: 42 }
        )
      );

      await expect(
        paymentService.finalizeCapturedPayment({
          localOrderId: 42,
          providerOrderId: "order_rzp_123",
          providerPaymentId: "pay_rzp_456",
          amountPaise: 50000,
          currency: "INR",
          providerStatus: "captured",
          userId: 7,
        })
      ).rejects.toThrowError(
        expect.objectContaining({
          code: "INVENTORY_RESERVATIONS_RELEASED",
          status: 409,
        })
      );
    });

    it("returns idempotent result if payment was already completed with same provider payment ID", async () => {
      const mockRecord = {
        order: {
          id: 42,
          userId: 7,
          storeId: 1,
          totalPrice: 500,
          status: "pending",
          couponId: null,
        },
        payment: {
          id: 101,
          provider: "razorpay",
          providerOrderId: "order_rzp_123",
          providerPaymentId: "pay_rzp_456",
          amountPaise: 50000,
          currency: "INR",
          status: "completed",
        },
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([mockRecord]),
                })),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const consumeSpy = vi.spyOn(
        inventoryService,
        "consumeReservationsForOrder"
      );

      const result = await paymentService.finalizeCapturedPayment({
        localOrderId: 42,
        providerOrderId: "order_rzp_123",
        providerPaymentId: "pay_rzp_456",
        amountPaise: 50000,
        currency: "INR",
        providerStatus: "captured",
        userId: 7,
      });

      expect(result.finalizedNow).toBe(false);
      expect(result.paymentStatus).toBe("completed");
      expect(consumeSpy).not.toHaveBeenCalled();
    });
  });

  describe("failure and cancellation", () => {
    it("releases reservations when provider order creation fails", async () => {
      const mockAttempt = {
        localOrderId: 42,
        localPaymentId: 101,
        userId: 7,
        storeId: 1,
        storeName: "Main Store",
        totalPrice: 500,
        couponId: null,
        provider: "razorpay" as const,
        amountPaise: 50000,
        currency: "INR" as const,
        status: "pending" as const,
        providerStatus: null,
        providerOrderId: null,
        failureCode: null,
        failureDescription: null,
      };

      const mockTx = {
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const releaseSpy = vi
        .spyOn(inventoryService, "releaseReservations")
        .mockResolvedValue(undefined as any);

      await (paymentService as any).markProviderCreationFailed(
        mockAttempt,
        "RAZORPAY_ORDER_CREATE_FAILED",
        "Creation failed"
      );

      expect(releaseSpy).toHaveBeenCalledWith(42, mockTx);
    });

    it("releases reservations when provider payment fails", async () => {
      const mockAttempt = {
        localOrderId: 42,
        localPaymentId: 101,
        userId: 7,
        storeId: 1,
        storeName: "Main Store",
        totalPrice: 500,
        couponId: null,
        provider: "razorpay" as const,
        amountPaise: 50000,
        currency: "INR" as const,
        status: "processing" as const,
        providerStatus: "created",
        providerOrderId: "order_rzp_123",
        failureCode: null,
        failureDescription: null,
      };

      const mockRecord = {
        order: {
          id: 42,
          userId: 7,
          storeId: 1,
          totalPrice: 500,
          status: "awaiting_payment",
          couponId: null,
        },
        payment: {
          id: 101,
          provider: "razorpay",
          providerOrderId: "order_rzp_123",
          providerPaymentId: null,
          amountPaise: 50000,
          currency: "INR",
          status: "processing",
        },
      };

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([mockRecord]),
                })),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const releaseSpy = vi
        .spyOn(inventoryService, "releaseReservations")
        .mockResolvedValue(undefined as any);

      await (paymentService as any).markProviderPaymentFailed(
        mockAttempt,
        {
          id: "pay_rzp_failed",
          orderId: "order_rzp_123",
          amountPaise: 50000,
          currency: "INR",
          status: "failed",
        },
        { code: "BAD_REQUEST_ERROR", description: "Payment failed" }
      );

      expect(releaseSpy).toHaveBeenCalledWith(42, mockTx);
    });
  });

  describe("reconcileExpiredReservations", () => {
    it("scans expired reservations and releases non-paid attempts", async () => {
      vi.spyOn(
        inventoryService,
        "getExpiredActiveReservationOrderIds"
      ).mockResolvedValue([42]);

      const mockAttempt = {
        localOrderId: 42,
        localPaymentId: 101,
        userId: 7,
        storeId: 1,
        storeName: "Main Store",
        totalPrice: 500,
        couponId: null,
        provider: "razorpay" as const,
        amountPaise: 50000,
        currency: "INR" as const,
        status: "pending" as const,
        providerStatus: null,
        providerOrderId: null,
        failureCode: null,
        failureDescription: null,
      };

      vi.spyOn(paymentService as any, "getAttemptByOrderId").mockResolvedValue(
        mockAttempt
      );

      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue([
                  { id: 42, status: "awaiting_payment" },
                ]),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) =>
        cb(mockTx as any)
      );
      const releaseSpy = vi
        .spyOn(inventoryService, "releaseReservations")
        .mockResolvedValue(undefined as any);

      const report = await paymentService.reconcileExpiredReservations(10);

      expect(report.scanned).toBe(1);
      expect(report.released).toBe(1);
      expect(report.finalized).toBe(0);
      expect(releaseSpy).toHaveBeenCalledWith(42, mockTx);
    });

    it("preserves reservations when provider state cannot be fetched", async () => {
      vi.spyOn(
        inventoryService,
        "getExpiredActiveReservationOrderIds"
      ).mockResolvedValue([42]);
      vi.spyOn(paymentService as any, "getAttemptByOrderId").mockResolvedValue({
        localOrderId: 42,
        localPaymentId: 101,
        userId: 7,
        storeId: 1,
        storeName: "Main Store",
        totalPrice: 500,
        couponId: null,
        provider: "razorpay",
        amountPaise: 50000,
        currency: "INR",
        status: "processing",
        providerStatus: "created",
        providerOrderId: "order_rzp_123",
        failureCode: null,
        failureDescription: null,
      });
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue({
        keyId: "rzp_test_key",
        keySecret: "rzp_test_secret",
        webhookSecret: "whsec_test",
      });
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue({
        fetchOrder: vi.fn().mockRejectedValue(new Error("Network timeout")),
        fetchOrderPayments: vi.fn().mockResolvedValue([]),
      } as any);
      const releaseSpy = vi.spyOn(inventoryService, "releaseReservations");
      const transactionSpy = vi.spyOn(db, "transaction");

      const report = await paymentService.reconcileExpiredReservations(10);

      expect(report).toMatchObject({
        scanned: 1,
        released: 0,
        errors: 1,
      });
      expect(report.results[0]).toMatchObject({
        orderId: 42,
        status: "error",
      });
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it("preserves reservations when provider configuration is unavailable", async () => {
      vi.spyOn(
        inventoryService,
        "getExpiredActiveReservationOrderIds"
      ).mockResolvedValue([42]);
      vi.spyOn(paymentService as any, "getAttemptByOrderId").mockResolvedValue({
        localOrderId: 42,
        localPaymentId: 101,
        provider: "razorpay",
        status: "processing",
        providerOrderId: "order_rzp_123",
      });
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(null);
      const releaseSpy = vi.spyOn(inventoryService, "releaseReservations");
      const transactionSpy = vi.spyOn(db, "transaction");

      const report = await paymentService.reconcileExpiredReservations(10);

      expect(report).toMatchObject({
        scanned: 1,
        released: 0,
        errors: 1,
      });
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
    });

    it("preserves a processing reservation with an unattached provider order", async () => {
      vi.spyOn(
        inventoryService,
        "getExpiredActiveReservationOrderIds"
      ).mockResolvedValue([42]);
      vi.spyOn(paymentService as any, "getAttemptByOrderId").mockResolvedValue({
        localOrderId: 42,
        localPaymentId: 101,
        provider: "razorpay",
        status: "processing",
        providerOrderId: null,
      });
      const releaseSpy = vi.spyOn(inventoryService, "releaseReservations");
      const transactionSpy = vi.spyOn(db, "transaction");

      const report = await paymentService.reconcileExpiredReservations(10);

      expect(report).toMatchObject({
        scanned: 1,
        released: 0,
        conflicts: 1,
      });
      expect(releaseSpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });
});
