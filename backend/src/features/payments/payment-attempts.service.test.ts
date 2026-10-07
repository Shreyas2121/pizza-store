import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { AppError } from "../../utils/error";
import checkoutService from "../checkout/checkout-snapshot.service";
import { promotionApplicationService } from "../promotions/applications";
import inventoryService from "../inventory/inventory.service";
import paymentRepository from "./payment.repository";
import paymentService from "./payment.service";
import paymentReconciliationService from "./payment-reconciliation.service";
import * as razorpayConfig from "./razorpay.config";
import * as razorpayGateway from "./razorpay.gateway";
import type { LocalRazorpayAttempt } from "./payment.types";

describe("Payment Attempts Lifecycle & Concurrency (P2.3)", () => {
  const sampleConfig = {
    keyId: "rzp_test_key_abc",
    keySecret: "rzp_test_secret_def",
    webhookSecret: "whsec_test_ghi",
  };

  const sampleAttempt: LocalRazorpayAttempt = {
    localOrderId: 201,
    localPaymentId: 301,
    userId: 15,
    storeId: 2,
    storeName: "Downtown Slice",
    grandTotalPaise: 85_000,
    discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
    amountPaise: 85000,
    currency: "INR",
    provider: "razorpay",
    status: "processing",
    providerOrderId: "order_rzp_201",
    providerStatus: "created",
    failureCode: null,
    failureDescription: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(paymentRepository, "lockLifecycleOwner").mockResolvedValue("awaiting_payment");
    vi.spyOn(inventoryService, "restoreReservationsForOrder").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "restore").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "consume").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "release").mockResolvedValue(undefined);
    vi.spyOn(razorpayConfig, "isRazorpayCheckoutEnabled").mockReturnValue(true);
    vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
  });

  describe("Duplicate client-request idempotency", () => {
    it("returns existing local attempt when repeated with identical clientRequestId", async () => {
      const getSpy = vi
        .spyOn(paymentRepository, "getAttemptByClientRequestId")
        .mockResolvedValue(sampleAttempt);
      const createOrderSpy = vi.spyOn(checkoutService, "createOrderSnapshot");

      const result = await (paymentService as any).findOrCreateLocalAttempt({
        userId: 15,
        addressId: 1,
        clientRequestId: "req_unique_abc",
      });

      expect(getSpy).toHaveBeenCalledWith("req_unique_abc");
      expect(createOrderSpy).not.toHaveBeenCalled();
      expect(result).toEqual(sampleAttempt);
      expect(result.localOrderId).toBe(201);
      expect(result.amountPaise).toBe(85000);
    });

    it("rejects with 409 PAYMENT_REQUEST_CONFLICT if clientRequestId is reused by a different user", async () => {
      vi.spyOn(paymentRepository, "getAttemptByClientRequestId").mockResolvedValue(
        sampleAttempt // userId: 15
      );

      await expect(
        (paymentService as any).findOrCreateLocalAttempt({
          userId: 99, // different user
          addressId: 1,
          clientRequestId: "req_unique_abc",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_REQUEST_CONFLICT",
      });
    });
  });

  describe("Duplicate provider-event idempotency", () => {
    it("safely finalizes payment once and returns finalizedNow: false on duplicate callback with same payment ID", async () => {
      const capturedRecord = {
        order: { id: 201, userId: 15, grandTotalPaise: 85_000, status: "pending" },
        payment: {
          id: 301,
          provider: "razorpay",
          providerOrderId: "order_rzp_201",
          providerPaymentId: "pay_rzp_dup_1",
          amountPaise: 85000,
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
                  limit: vi.fn().mockResolvedValue([capturedRecord]),
                })),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));

      const result = await paymentReconciliationService.finalizeCapturedPayment({
        userId: 15,
        localOrderId: 201,
        providerOrderId: "order_rzp_201",
        providerPaymentId: "pay_rzp_dup_1",
        amountPaise: 85000,
        currency: "INR",
        providerStatus: "captured",
      });

      expect(result).toEqual({
        localOrderId: 201,
        localPaymentId: 301,
        totalPrice: 850,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: false,
      });
    });

    it("rejects with 409 PAYMENT_ALREADY_COMPLETED if already finalized with a different providerPaymentId", async () => {
      const capturedRecord = {
        order: { id: 201, userId: 15, grandTotalPaise: 85_000, status: "pending" },
        payment: {
          id: 301,
          provider: "razorpay",
          providerOrderId: "order_rzp_201",
          providerPaymentId: "pay_original_111",
          amountPaise: 85000,
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
                  limit: vi.fn().mockResolvedValue([capturedRecord]),
                })),
              })),
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));

      await expect(
        paymentReconciliationService.finalizeCapturedPayment({
          userId: 15,
          localOrderId: 201,
          providerOrderId: "order_rzp_201",
          providerPaymentId: "pay_conflicting_222",
          amountPaise: 85000,
          currency: "INR",
          providerStatus: "captured",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_ALREADY_COMPLETED",
      });
    });
  });

  describe("Concurrent attempt race conditions", () => {
    it("handles concurrent initiation race where second transaction catches unique key conflict and returns first attempt", async () => {
      let firstAttemptQueried = false;
      vi.spyOn(paymentRepository, "getAttemptByClientRequestId").mockImplementation(
        async () => {
          if (firstAttemptQueried) {
            return sampleAttempt;
          }
          firstAttemptQueried = true;
          return undefined;
        }
      );

      // Simulates first attempt throwing unique conflict during concurrent insert
      vi.spyOn(db, "transaction").mockRejectedValueOnce(
        new Error("duplicate key value violates unique constraint")
      );

      const resolved = await (paymentService as any).findOrCreateLocalAttempt({
        userId: 15,
        addressId: 1,
        clientRequestId: "req_concurrent_123",
      });

      expect(resolved).toEqual(sampleAttempt);
      expect(resolved.userId).toBe(15);
      expect(resolved.localOrderId).toBe(201);
    });
  });

  describe("Retry workflows preserving order identity", () => {
    it("retries a failed payment on existing order without changing order, customer, store, or amount identity", async () => {
      const failedAttempt: LocalRazorpayAttempt = {
        ...sampleAttempt,
        status: "failed",
        failureCode: "BAD_REQUEST",
        failureDescription: "Payment failed",
      };

      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(failedAttempt);
      vi.spyOn(paymentService as any, "reactivateProviderOrder").mockResolvedValue({
        ...failedAttempt,
        status: "processing",
        failureCode: null,
        failureDescription: null,
      });

      const response = await paymentService.retryRazorpayOrder(201, 15);

      expect(response.localOrderId).toBe(201);
      expect(response.localPaymentId).toBe(301);
      expect(response.amountPaise).toBe(85000);
      expect(response.paymentStatus).toBe("processing");
      expect(response.razorpayOrderId).toBe("order_rzp_201");
      expect(response.checkoutReady).toBe(true);
    });

    it("rejects retry if user does not own the order", async () => {
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt);

      await expect(
        paymentService.retryRazorpayOrder(201, 999) // wrong user
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it("rejects retry if attempt is for COD", async () => {
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({
        ...sampleAttempt,
        provider: "cod",
      });

      await expect(
        paymentService.retryRazorpayOrder(201, 15)
      ).rejects.toMatchObject({
        status: 404,
      });
    });
  });
});
