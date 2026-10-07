import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import { promotionApplicationService } from "../promotions/applications";
import inventoryService from "../inventory/inventory.service";
import * as paymentHelpers from "./payment.helpers";
import paymentReconciliationService from "./payment-reconciliation.service";
import paymentRepository from "./payment.repository";
import * as razorpayConfig from "./razorpay.config";
import * as razorpayGateway from "./razorpay.gateway";
import type { LocalRazorpayAttempt } from "./payment.types";
import type {
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
  RazorpayServerConfig,
} from "./razorpay.types";

describe("PaymentReconciliationService characterization tests", () => {
  const sampleConfig: RazorpayServerConfig = {
    keyId: "rzp_test_key_123",
    keySecret: "rzp_test_secret_456",
    webhookSecret: "whsec_test_789",
  };

  const sampleAttempt: LocalRazorpayAttempt = {
    localOrderId: 100,
    localPaymentId: 200,
    userId: 5,
    storeId: 1,
    storeName: "Main Store",
    grandTotalPaise: 45_000,
    discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
    amountPaise: 45000,
    currency: "INR",
    provider: "razorpay",
    status: "processing",
    providerOrderId: "order_rzp_test_100",
    providerStatus: "created",
    failureCode: null,
    failureDescription: null,
  };

  const sampleProviderOrder: RazorpayOrderSnapshot = {
    id: "order_rzp_test_100",
    amountPaise: 45000,
    amountPaidPaise: 45000,
    amountDuePaise: 0,
    currency: "INR",
    receipt: "order_100_payment_200",
    status: "paid",
    attempts: 1,
  };

  const sampleProviderPayment: RazorpayPaymentSnapshot = {
    id: "pay_rzp_test_200",
    orderId: "order_rzp_test_100",
    amountPaise: 45000,
    currency: "INR",
    status: "captured",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(paymentRepository, "getExpiredAwaitingOrderIds").mockResolvedValue([]);
    vi.spyOn(paymentRepository, "lockLifecycleOwner").mockResolvedValue("awaiting_payment");
    vi.spyOn(inventoryService, "restoreReservationsForOrder").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "restore").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "consume").mockResolvedValue(undefined);
    vi.spyOn(promotionApplicationService, "release").mockResolvedValue(undefined);
  });

  describe("verifyRazorpayPayment", () => {
    it("throws 503 PAYMENT_UNAVAILABLE when Razorpay config is missing", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(null);

      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_test_100",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_valid_123",
        })
      ).rejects.toMatchObject({
        status: 503,
        code: "PAYMENT_UNAVAILABLE",
      });
    });

    it("throws 404 when attempt is not found, wrong user, or provider is not razorpay", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(undefined as any);

      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_test_100",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_valid_123",
        })
      ).rejects.toMatchObject({
        status: 404,
      });

      // User mismatch
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({
        ...sampleAttempt,
        userId: 999,
      } as any);
      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_test_100",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_valid_123",
        })
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it("throws 409 PAYMENT_ORDER_NOT_READY when attempt has no providerOrderId", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({
        ...sampleAttempt,
        providerOrderId: null,
      } as any);

      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_test_100",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_valid_123",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_ORDER_NOT_READY",
      });
    });

    it("throws 400 PAYMENT_ORDER_MISMATCH when submitted orderId does not match attempt providerOrderId", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt as any);

      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_DIFFERENT",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_valid_123",
        })
      ).rejects.toMatchObject({
        status: 400,
        code: "PAYMENT_ORDER_MISMATCH",
      });
    });

    it("throws 400 PAYMENT_SIGNATURE_INVALID when HMAC signature check fails", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt as any);
      vi.spyOn(paymentHelpers, "isValidCheckoutSignature").mockReturnValue(false);

      await expect(
        paymentReconciliationService.verifyRazorpayPayment({
          userId: 5,
          localOrderId: 100,
          razorpayOrderId: "order_rzp_test_100",
          razorpayPaymentId: "pay_rzp_test_200",
          razorpaySignature: "sig_invalid",
        })
      ).rejects.toMatchObject({
        status: 400,
        code: "PAYMENT_SIGNATURE_INVALID",
      });
    });

    it("delegates to reconcileProviderPayment and returns finalized result on valid signature", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt as any);
      vi.spyOn(paymentHelpers, "isValidCheckoutSignature").mockReturnValue(true);
      vi.spyOn(paymentReconciliationService, "reconcileProviderPayment").mockResolvedValue({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });

      const result = await paymentReconciliationService.verifyRazorpayPayment({
        userId: 5,
        localOrderId: 100,
        razorpayOrderId: "order_rzp_test_100",
        razorpayPaymentId: "pay_rzp_test_200",
        razorpaySignature: "sig_valid_123",
      });

      expect(result).toMatchObject({
        localOrderId: 100,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });
    });
  });

  describe("reconcileProviderPayment", () => {
    it("throws 404 for unknown provider order when userId is provided", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(undefined as any);

      await expect(
        paymentReconciliationService.reconcileProviderPayment(
          "order_unknown",
          "pay_unknown",
          { userId: 5 }
        )
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it("returns ignored: true without throwing for unknown provider order in webhook mode (userId undefined)", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(undefined as any);

      const result = await paymentReconciliationService.reconcileProviderPayment(
        "order_unknown",
        "pay_unknown"
      );

      expect(result).toEqual({ ignored: true, finalizedNow: false });
    });

    it("throws 502 PAYMENT_PROVIDER_UNAVAILABLE when gateway fails to fetch state", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchPayment: vi.fn().mockRejectedValue(new Error("Network timeout")),
        fetchOrder: vi.fn().mockResolvedValue(sampleProviderOrder),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      await expect(
        paymentReconciliationService.reconcileProviderPayment(
          "order_rzp_test_100",
          "pay_rzp_test_200",
          { userId: 5 }
        )
      ).rejects.toMatchObject({
        status: 502,
        code: "PAYMENT_PROVIDER_UNAVAILABLE",
      });
    });

    it("throws 409 PAYMENT_PROVIDER_MISMATCH when provider order amount differs from local attempt", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue(sampleProviderPayment),
        fetchOrder: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          amountPaise: 99999, // mismatch
        }),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      await expect(
        paymentReconciliationService.reconcileProviderPayment(
          "order_rzp_test_100",
          "pay_rzp_test_200",
          { userId: 5 }
        )
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_PROVIDER_MISMATCH",
      });
    });

    it("throws 409 PAYMENT_NOT_CAPTURED when requireCaptured is true and payment is authorized only", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue({
          ...sampleProviderPayment,
          status: "authorized",
        }),
        fetchOrder: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          status: "attempted",
        }),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      await expect(
        paymentReconciliationService.reconcileProviderPayment(
          "order_rzp_test_100",
          "pay_rzp_test_200",
          { userId: 5, requireCaptured: true }
        )
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_NOT_CAPTURED",
      });
    });

    it("finalizes payment when provider payment is captured and order is paid", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue(sampleProviderPayment),
        fetchOrder: vi.fn().mockResolvedValue(sampleProviderOrder),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      vi.spyOn(paymentReconciliationService, "finalizeCapturedPayment").mockResolvedValue({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });

      const result = await paymentReconciliationService.reconcileProviderPayment(
        "order_rzp_test_100",
        "pay_rzp_test_200",
        { userId: 5 }
      );

      expect(result).toMatchObject({
        localOrderId: 100,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });
    });

    it("recovers captured payment when initial payment snapshot is failed but order has captured payment", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const failedPayment: RazorpayPaymentSnapshot = {
        ...sampleProviderPayment,
        id: "pay_failed_1",
        status: "failed",
      };
      const capturedPayment: RazorpayPaymentSnapshot = {
        ...sampleProviderPayment,
        id: "pay_captured_2",
        status: "captured",
      };

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue(failedPayment),
        fetchOrder: vi.fn().mockResolvedValue(sampleProviderOrder),
        fetchOrderPayments: vi.fn().mockResolvedValue([failedPayment, capturedPayment]),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      const finalizeSpy = vi
        .spyOn(paymentReconciliationService, "finalizeCapturedPayment")
        .mockResolvedValue({
          localOrderId: 100,
          localPaymentId: 200,
          totalPrice: 450,
          paymentStatus: "completed",
          orderStatus: "pending",
          finalizedNow: true,
        });

      const result = await paymentReconciliationService.reconcileProviderPayment(
        "order_rzp_test_100",
        "pay_failed_1"
      );

      expect(finalizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          providerPaymentId: "pay_captured_2",
        })
      );
      expect(result.finalizedNow).toBe(true);
    });

    it("marks payment failed and releases reservations when provider payment failed definitively", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const failedPayment: RazorpayPaymentSnapshot = {
        ...sampleProviderPayment,
        status: "failed",
      };

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue(failedPayment),
        fetchOrder: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          status: "attempted",
        }),
        fetchOrderPayments: vi.fn().mockResolvedValue([failedPayment]),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      const markFailedSpy = vi
        .spyOn(paymentReconciliationService, "markProviderPaymentFailed")
        .mockResolvedValue({
          localOrderId: 100,
          localPaymentId: 200,
          totalPrice: 450,
          paymentStatus: "failed",
          orderStatus: "awaiting_payment",
          finalizedNow: false,
        });

      const result = await paymentReconciliationService.reconcileProviderPayment(
        "order_rzp_test_100",
        "pay_rzp_test_200",
        { failureCode: "BAD_REQUEST_ERROR", failureDescription: "Card declined" }
      );

      expect(markFailedSpy).toHaveBeenCalled();
      expect(result).toMatchObject({
        paymentStatus: "failed",
        finalizedNow: false,
      });
    });

    it("records provider observation and returns awaiting_payment without mutation for non-terminal authorized state", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const authorizedPayment: RazorpayPaymentSnapshot = {
        ...sampleProviderPayment,
        status: "authorized",
      };

      const mockGateway = {
        fetchPayment: vi.fn().mockResolvedValue(authorizedPayment),
        fetchOrder: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          status: "attempted",
        }),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      vi.spyOn(paymentReconciliationService as any, "recordProviderObservation").mockResolvedValue(undefined);

      const result = await paymentReconciliationService.reconcileProviderPayment(
        "order_rzp_test_100",
        "pay_rzp_test_200",
        { requireCaptured: false }
      );

      expect(result).toEqual({
        localOrderId: 100,
        localPaymentId: 200,
        paymentStatus: "processing",
        orderStatus: "awaiting_payment",
        finalizedNow: false,
      });
    });
  });

  describe("finalizeCapturedPayment", () => {
    it("handles idempotent re-verification when payment is already completed with identical providerPaymentId", async () => {
      const mockRecord = {
        order: {
          id: 100,
          userId: 5,
          grandTotalPaise: 45_000,
          status: "pending",
          discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
        },
        payment: {
          id: 200,
          provider: "razorpay",
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: "pay_rzp_test_200",
          amountPaise: 45000,
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

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));
      const consumeInventorySpy = vi.spyOn(inventoryService, "consumeReservationsForOrder");
      const consumeCouponSpy = vi.spyOn(promotionApplicationService, "consume");

      const result = await paymentReconciliationService.finalizeCapturedPayment({
        userId: 5,
        localOrderId: 100,
        providerOrderId: "order_rzp_test_100",
        providerPaymentId: "pay_rzp_test_200",
        amountPaise: 45000,
        currency: "INR",
        providerStatus: "captured",
      });

      expect(result).toEqual({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: false,
      });
      expect(consumeInventorySpy).not.toHaveBeenCalled();
      expect(consumeCouponSpy).not.toHaveBeenCalled();
    });

    it("throws 409 PAYMENT_ALREADY_COMPLETED when completed payment is submitted with different provider payment ID", async () => {
      const mockRecord = {
        order: {
          id: 100,
          userId: 5,
          grandTotalPaise: 45_000,
          status: "pending",
          discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
        },
        payment: {
          id: 200,
          provider: "razorpay",
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: "pay_ORIGINAL_ID",
          amountPaise: 45000,
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

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));

      await expect(
        paymentReconciliationService.finalizeCapturedPayment({
          userId: 5,
          localOrderId: 100,
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: "pay_DIFFERENT_ID",
          amountPaise: 45000,
          currency: "INR",
          providerStatus: "captured",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_ALREADY_COMPLETED",
      });
    });

    it("throws 409 PAYMENT_ORDER_NOT_PAYABLE when order is not in awaiting_payment status", async () => {
      const mockRecord = {
        order: {
          id: 100,
          userId: 5,
          grandTotalPaise: 45_000,
          status: "cancelled", // ineligible status
          discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
        },
        payment: {
          id: 200,
          provider: "razorpay",
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: null,
          amountPaise: 45000,
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
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));

      await expect(
        paymentReconciliationService.finalizeCapturedPayment({
          userId: 5,
          localOrderId: 100,
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: "pay_rzp_test_200",
          amountPaise: 45000,
          currency: "INR",
          providerStatus: "captured",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_ORDER_NOT_PAYABLE",
      });
    });

    it("throws 409 PAYMENT_PROVIDER_MISMATCH if providerPaymentId is already attached to another payment", async () => {
      const mockRecord = {
        order: {
          id: 100,
          userId: 5,
          grandTotalPaise: 45_000,
          status: "awaiting_payment",
          discountMode: "none", orderStatus: "awaiting_payment", promotions: [],
        },
        payment: {
          id: 200,
          provider: "razorpay",
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: null,
          amountPaise: 45000,
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
              limit: vi.fn().mockResolvedValue([{ id: 999 }]), // another payment already has this providerPaymentId
            })),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));

      await expect(
        paymentReconciliationService.finalizeCapturedPayment({
          userId: 5,
          localOrderId: 100,
          providerOrderId: "order_rzp_test_100",
          providerPaymentId: "pay_rzp_test_200",
          amountPaise: 45000,
          currency: "INR",
          providerStatus: "captured",
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_PROVIDER_MISMATCH",
      });
    });
  });

  describe("reconcileStalePayments", () => {
    it("throws 503 when config is unavailable", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(null);

      await expect(
        paymentReconciliationService.reconcileStalePayments(15, 10)
      ).rejects.toMatchObject({
        status: 503,
        code: "PAYMENT_UNAVAILABLE",
      });
    });

    it("recovers an unattached provider order by receipt and reconciles it", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);

      const candidateWithoutProviderOrderId = {
        ...sampleAttempt,
        providerOrderId: null,
        status: "processing" as const,
      };

      vi.spyOn(paymentRepository, "selectAttempts").mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([candidateWithoutProviderOrderId]),
        }),
      } as any);

      const mockGateway = {
        findOrderByReceipt: vi.fn().mockResolvedValue(sampleProviderOrder),
        fetchOrder: vi.fn().mockResolvedValue(sampleProviderOrder),
        fetchOrderPayments: vi.fn().mockResolvedValue([sampleProviderPayment]),
        fetchPayment: vi.fn().mockResolvedValue(sampleProviderPayment),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      vi.spyOn(paymentReconciliationService as any, "attachRecoveredProviderOrder").mockResolvedValue(undefined);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue({
        ...sampleAttempt,
        providerOrderId: sampleProviderOrder.id,
      } as any);
      vi.spyOn(paymentReconciliationService, "finalizeCapturedPayment").mockResolvedValue({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });

      const summary = await paymentReconciliationService.reconcileStalePayments(15, 10);

      expect(summary.checked).toBe(1);
      expect(summary.finalized).toBe(1);
      expect(summary.errors).toBe(0);
      expect(summary.results[0].status).toBe("finalized");
    });

    it("records error status when recovered provider order details mismatch", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);

      const candidateWithoutProviderOrderId = {
        ...sampleAttempt,
        providerOrderId: null,
        amountPaise: 45000,
        currency: "INR" as const,
        status: "processing" as const,
      };

      vi.spyOn(paymentRepository, "selectAttempts").mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([candidateWithoutProviderOrderId]),
        }),
      } as any);

      const mockGateway = {
        findOrderByReceipt: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          amountPaise: 99999, // mismatch
        }),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      const summary = await paymentReconciliationService.reconcileStalePayments(15, 10);

      expect(summary.checked).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.results[0].status).toBe("error");
      expect(summary.results[0].error).toContain("Recovered provider order does not match local payment");
    });
  });

  describe("reconcileExpiredReservations", () => {
    it("releases reservation when no local payment attempt is found for expired order", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([100]);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(undefined as any);

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb({} as any));
      const releaseSpy = vi.spyOn(inventoryService, "releaseReservations").mockResolvedValue(undefined as any);

      const summary = await paymentReconciliationService.reconcileExpiredReservations(25);

      expect(summary.scanned).toBe(1);
      expect(summary.released).toBe(1);
      expect(releaseSpy).toHaveBeenCalledWith(100, expect.anything());
    });

    it("skips expired reservation check if payment is already completed", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([100]);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({
        ...sampleAttempt,
        status: "completed",
      } as any);

      const summary = await paymentReconciliationService.reconcileExpiredReservations(25);

      expect(summary.scanned).toBe(1);
      expect(summary.skipped).toBe(1);
      expect(summary.results[0].status).toBe("skipped");
    });

    it("preserves reservation and flags conflict when processing attempt has no providerOrderId", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([100]);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue({
        ...sampleAttempt,
        status: "processing",
        providerOrderId: null,
      } as any);

      const summary = await paymentReconciliationService.reconcileExpiredReservations(25);

      expect(summary.scanned).toBe(1);
      expect(summary.conflicts).toBe(1);
      expect(summary.results[0].status).toBe("conflict");
    });

    it("finalizes expired reservation order when provider shows paid & captured", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([100]);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchOrder: vi.fn().mockResolvedValue(sampleProviderOrder),
        fetchOrderPayments: vi.fn().mockResolvedValue([sampleProviderPayment]),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      vi.spyOn(paymentReconciliationService, "reconcileProviderPayment").mockResolvedValue({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });

      const summary = await paymentReconciliationService.reconcileExpiredReservations(25);

      expect(summary.scanned).toBe(1);
      expect(summary.finalized).toBe(1);
      expect(summary.results[0].status).toBe("finalized");
    });

    it("cancels order, marks payment failed RESERVATION_EXPIRED, and releases stock when provider order was never paid", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(inventoryService, "getExpiredActiveReservationOrderIds").mockResolvedValue([100]);
      vi.spyOn(paymentRepository, "getAttemptByOrderId").mockResolvedValue(sampleAttempt as any);

      const unpaidOrder: RazorpayOrderSnapshot = {
        ...sampleProviderOrder,
        status: "created",
        amountPaidPaise: 0,
      };

      const mockGateway = {
        fetchOrder: vi.fn().mockResolvedValue(unpaidOrder),
        fetchOrderPayments: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      let selectCallCount = 0;
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              for: vi.fn(() => ({
                limit: vi.fn().mockImplementation(() => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                    return Promise.resolve([{ id: 100, status: "awaiting_payment" }]);
                  }
                  return Promise.resolve([{ id: 200, status: "processing", providerOrderId: sampleAttempt.providerOrderId, updatedAt: new Date("2026-01-01") }]);
                }),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve([])),
          })),
        })),
      };

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));
      const updatePaymentSpy = vi.spyOn(paymentRepository, "updatePayment").mockResolvedValue(undefined as any);
      const releaseInventorySpy = vi.spyOn(inventoryService, "releaseReservations").mockResolvedValue(undefined as any);
      const releaseCouponSpy = vi.spyOn(promotionApplicationService, "release").mockResolvedValue(undefined as any);

      const summary = await paymentReconciliationService.reconcileExpiredReservations(25);

      expect(summary.scanned).toBe(1);
      expect(summary.released).toBe(1);
      expect(updatePaymentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          failureCode: "RESERVATION_EXPIRED",
        }),
        200,
        mockTx
      );
      expect(releaseInventorySpy).toHaveBeenCalledWith(100, mockTx);
      expect(releaseCouponSpy).toHaveBeenCalledWith(100, mockTx);
    });
  });

  describe("reconcileProviderOrder", () => {
    it("returns ignored: true when attempt is not found for providerOrderId", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(undefined as any);

      const result = await paymentReconciliationService.reconcileProviderOrder("order_unknown");

      expect(result).toEqual({ ignored: true, finalizedNow: false });
    });

    it("asserts match and records observation without finalization when provider order has no payments", async () => {
      vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
      vi.spyOn(paymentRepository, "getAttemptByProviderOrderId").mockResolvedValue(sampleAttempt as any);

      const mockGateway = {
        fetchOrder: vi.fn().mockResolvedValue({
          ...sampleProviderOrder,
          status: "created",
        }),
        fetchOrderPayments: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);
      const recordObsSpy = vi.spyOn(paymentReconciliationService as any, "recordProviderObservation").mockResolvedValue(undefined);

      const result = await paymentReconciliationService.reconcileProviderOrder("order_rzp_test_100");

      expect(recordObsSpy).toHaveBeenCalled();
      expect(result).toEqual({
        localOrderId: 100,
        localPaymentId: 200,
        paymentStatus: "processing",
        orderStatus: "awaiting_payment",
        finalizedNow: false,
      });
    });
  });

  describe("markProviderPaymentFailed", () => {
    it("does not mutate payment or order if payment is already completed", async () => {
      const mockRecord = {
        order: {
          id: 100,
          grandTotalPaise: 45_000,
          status: "pending",
        },
        payment: {
          id: 200,
          providerOrderId: "order_rzp_test_100",
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

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));
      const updatePaymentSpy = vi.spyOn(paymentRepository, "updatePayment");

      const result = await paymentReconciliationService.markProviderPaymentFailed(
        sampleAttempt,
        sampleProviderPayment,
        { code: "FAILED", description: "Failed" }
      );

      expect(result).toEqual({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: false,
      });
      expect(updatePaymentSpy).not.toHaveBeenCalled();
    });

    it("updates payment to failed, releases coupon and inventory reservations", async () => {
      const mockRecord = {
        order: {
          id: 100,
          grandTotalPaise: 45_000,
          status: "awaiting_payment",
        },
        payment: {
          id: 200,
          providerOrderId: "order_rzp_test_100",
          status: "pending",
        },
      };

      const mockTx = {
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
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

      vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx as any));
      const updatePaymentSpy = vi.spyOn(paymentRepository, "updatePayment").mockResolvedValue(undefined as any);
      const releaseCouponSpy = vi.spyOn(promotionApplicationService, "release").mockResolvedValue(undefined as any);
      const releaseInventorySpy = vi.spyOn(inventoryService, "releaseReservations").mockResolvedValue(undefined as any);

      const result = await paymentReconciliationService.markProviderPaymentFailed(
        sampleAttempt,
        sampleProviderPayment,
        { code: "BAD_REQUEST", description: "Payment declined by issuing bank" }
      );

      expect(result).toEqual({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "failed",
        orderStatus: "awaiting_payment",
        finalizedNow: false,
      });
      expect(updatePaymentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          failureCode: "BAD_REQUEST",
        }),
        200,
        mockTx
      );
      expect(releaseCouponSpy).toHaveBeenCalledWith(100, mockTx);
      expect(releaseInventorySpy).toHaveBeenCalledWith(100, mockTx);
    });
  });
});
