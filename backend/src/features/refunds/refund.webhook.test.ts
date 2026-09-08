import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import auditService from "../audit/audit.service";
import authorizationService from "../access/access.service";
import paymentService from "../payments/payment.service";
import * as razorpayConfig from "../payments/razorpay.config";
import * as razorpayGateway from "../payments/razorpay.gateway";
import razorpayWebhookService from "../payments/razorpay.webhook";
import type { RazorpayServerConfig } from "../payments/razorpay.types";
import refundRepository from "./refund.repository";
import refundService from "./refund.service";
import financialEventService from "../finance-events/financial-event.service";

describe("Refund Webhooks and Provider Events (P2.7)", () => {
  const sampleConfig: RazorpayServerConfig = {
    mode: "razorpay_test",
    keyId: "rzp_test_key_123",
    keySecret: "rzp_test_secret_456",
    webhookSecret: "whsec_refund_test_789",
  };

  const sampleRefund = {
    id: 42,
    orderId: 100,
    paymentAttemptId: 200,
    storeId: 1,
    amountPaise: 15_000,
    currency: "INR" as const,
    status: "submitted" as const,
    reasonCode: "customer_cancellation",
    reasonNote: "Customer cancelled item",
    clientRequestId: "req-42-uuid",
    providerRefundId: null as string | null,
    providerStatus: null as string | null,
    failureCode: null as string | null,
    failureDescription: null as string | null,
    version: 3,
    requestedBy: 5,
    approvedBy: 6,
    rejectedBy: null,
    cancelledBy: null,
    submittedBy: 6,
    processedBy: null,
    requestedAt: new Date("2026-09-01T10:00:00Z"),
    approvedAt: new Date("2026-09-01T10:05:00Z"),
    rejectedAt: null,
    cancelledAt: null,
    submittedAt: new Date("2026-09-01T10:06:00Z"),
    processedAt: null,
    failedAt: null,
    createdAt: new Date("2026-09-01T10:00:00Z"),
    updatedAt: new Date("2026-09-01T10:06:00Z"),
  };

  const sampleAttempt = {
    id: 200,
    orderId: 100,
    storeId: 1,
    amountPaise: 45_000,
    currency: "INR" as const,
    provider: "razorpay" as const,
    status: "captured" as const,
    providerOrderId: "order_rzp_100",
    providerPaymentId: "pay_rzp_200",
  };

  const sampleOrder = {
    id: 100,
    storeId: 1,
    status: "pending",
  };

  const sign = (body: string, secret: string = sampleConfig.webhookSecret) =>
    createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex");

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(razorpayConfig, "getRazorpayConfig").mockReturnValue(sampleConfig);
    vi.spyOn(auditService, "write").mockResolvedValue();
    vi.spyOn(refundRepository, "transaction").mockImplementation(async (work) => work({} as any));
    vi.spyOn(refundRepository, "lockOrder").mockResolvedValue(sampleOrder as any);
    vi.spyOn(refundRepository, "lockPaymentAttempts").mockResolvedValue([sampleAttempt] as any);
    vi.spyOn(refundRepository, "lockRefund").mockResolvedValue({ ...sampleRefund } as any);
    vi.spyOn(refundRepository, "getPaymentAttempt").mockResolvedValue(sampleAttempt as any);
    vi.spyOn(refundRepository, "findStore").mockResolvedValue({ id: 1, timezone: "Asia/Kolkata" });
    vi.spyOn(refundRepository, "allocations").mockResolvedValue([{
      id: 1, refundId: 42, orderId: 100, kind: "item", orderItemId: 10, quantity: 1,
      amountPaise: 15_000, taxableAmountPaise: 14_286, taxPaise: 714,
      discountReversalPaise: 0, createdAt: new Date(),
    }]);
    vi.spyOn(financialEventService, "write").mockResolvedValue({} as never);
    vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue(undefined);
    vi.spyOn(refundRepository, "findById").mockResolvedValue(undefined);
    vi.spyOn(refundRepository, "update").mockImplementation(async (_tx, id, patch) => ({
      ...sampleRefund,
      ...patch,
      id,
    } as any));
  });

  describe("RazorpayWebhookService signature verification & inbox routing", () => {
    it("rejects an invalid webhook signature with 400 WEBHOOK_SIGNATURE_INVALID", async () => {
      const payload = JSON.stringify({ event: "refund.processed", payload: {} });
      const rawBody = Buffer.from(payload, "utf8");

      await expect(
        razorpayWebhookService.handle(rawBody, "invalid_hex_signature".padEnd(64, "0"), "evt_1")
      ).rejects.toMatchObject({
        status: 400,
        code: "WEBHOOK_SIGNATURE_INVALID",
      });
    });

    it("claims event in paymentWebhookEventsTable and returns duplicate on repeated processed event", async () => {
      const body = JSON.stringify({
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test_123",
              payment_id: "pay_rzp_200",
              amount: 15_000,
              currency: "INR",
              status: "processed",
              receipt: "refund_42_v3",
            },
          },
        },
      });
      const rawBody = Buffer.from(body, "utf8");
      const signature = sign(body);

      vi.spyOn(db, "insert").mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => [{ id: 1 }],
          }),
        }),
      } as any);

      const updateSpy = vi.spyOn(db, "update").mockReturnValue({
        set: () => ({
          where: async () => [],
        }),
      } as any);

      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: { ...sampleRefund },
        allocations: [],
      } as any);
      vi.spyOn(refundRepository, "update").mockResolvedValue({
        ...sampleRefund,
        status: "processed",
        providerRefundId: "rfnd_test_123",
        version: 4,
      } as any);

      const result = await razorpayWebhookService.handle(rawBody, signature, "evt_unique_1");
      expect(result.duplicate).toBe(false);
      expect(result.eventType).toBe("refund.processed");
      expect(updateSpy).toHaveBeenCalled();
    });

    it("preserves payment event handling without weakening existing reconciliation", async () => {
      const body = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_200",
              order_id: "order_rzp_100",
              amount: 45_000,
              currency: "INR",
              status: "captured",
            },
          },
        },
      });
      const rawBody = Buffer.from(body, "utf8");
      const signature = sign(body);

      vi.spyOn(db, "insert").mockReturnValue({
        values: () => ({
          onConflictDoNothing: () => ({
            returning: async () => [{ id: 2 }],
          }),
        }),
      } as any);
      vi.spyOn(db, "update").mockReturnValue({
        set: () => ({
          where: async () => [],
        }),
      } as any);

      const reconcileSpy = vi.spyOn(paymentService, "reconcileProviderPayment").mockResolvedValue({
        localOrderId: 100,
        localPaymentId: 200,
        totalPrice: 450,
        paymentStatus: "completed",
        orderStatus: "pending",
        finalizedNow: true,
      });

      const result = await razorpayWebhookService.handle(rawBody, signature, "evt_payment_1");
      expect(reconcileSpy).toHaveBeenCalledWith("order_rzp_100", "pay_rzp_200", {});
      expect(result.eventType).toBe("payment.captured");
    });
  });

  describe("processProviderWebhookEvent transitions and idempotency", () => {
    it("transitions submitted refund to processed on refund.processed", async () => {
      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue(undefined);
      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: { ...sampleRefund },
        allocations: [],
      } as any);
      const updateSpy = vi.spyOn(refundRepository, "update").mockImplementation(async (_tx, id, patch) => ({
        ...sampleRefund,
        ...patch,
        id,
      } as any));

      const result = await refundService.processProviderWebhookEvent({
        event: "refund.processed",
        refund: {
          id: "rfnd_999",
          payment_id: "pay_rzp_200",
          amount: 15_000,
          currency: "INR",
          status: "processed",
          receipt: "refund_42_v3",
        },
      });

      expect(result).toMatchObject({ duplicate: false, inProgress: false });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        42,
        expect.objectContaining({
          status: "processed",
          providerRefundId: "rfnd_999",
          providerStatus: "processed",
        })
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "refund.provider_processed",
          resourceId: 42,
        })
      );
      expect(financialEventService.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "refund.processed" }));
      expect(financialEventService.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: "refund.disbursed" }));
    });

    it("handles duplicate processed event idempotently without updating or re-auditing", async () => {
      const alreadyProcessed = {
        ...sampleRefund,
        status: "processed" as const,
        providerRefundId: "rfnd_999",
        providerStatus: "processed",
        processedAt: new Date("2026-09-01T10:10:00Z"),
      };

      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue({
        refund: alreadyProcessed,
        allocations: [],
      } as any);
      vi.spyOn(refundRepository, "lockRefund").mockResolvedValue(alreadyProcessed as any);
      const updateSpy = vi.spyOn(refundRepository, "update");

      const result = await refundService.processProviderWebhookEvent({
        event: "refund.processed",
        refund: {
          id: "rfnd_999",
          payment_id: "pay_rzp_200",
          amount: 15_000,
          currency: "INR",
          status: "processed",
        },
      });

      expect(result).toMatchObject({ duplicate: true, inProgress: false });
      expect(updateSpy).not.toHaveBeenCalled();
      expect(auditService.write).not.toHaveBeenCalled();
    });

    it("transitions submitted refund to failed on refund.failed with error metadata", async () => {
      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue(undefined);
      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: { ...sampleRefund },
        allocations: [],
      } as any);
      const updateSpy = vi.spyOn(refundRepository, "update").mockImplementation(async (_tx, id, patch) => ({
        ...sampleRefund,
        ...patch,
        id,
      } as any));

      const result = await refundService.processProviderWebhookEvent({
        event: "refund.failed",
        refund: {
          id: "rfnd_fail_77",
          payment_id: "pay_rzp_200",
          amount: 15_000,
          currency: "INR",
          status: "failed",
          receipt: "refund_42_v3",
          error_code: "GATEWAY_TIMEOUT",
          error_description: "Bank failed to respond in time",
        },
      });

      expect(result).toMatchObject({ duplicate: false, inProgress: false });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        42,
        expect.objectContaining({
          status: "failed",
          providerRefundId: "rfnd_fail_77",
          failureCode: "GATEWAY_TIMEOUT",
          failureDescription: "Bank failed to respond in time",
        })
      );
      expect(auditService.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "refund.provider_failed",
          resourceId: 42,
          outcome: "failure",
        })
      );
    });

    it("out-of-order protection: ignores refund.failed received after refund is already processed", async () => {
      const processedRefund = {
        ...sampleRefund,
        status: "processed" as const,
        providerRefundId: "rfnd_999",
        providerStatus: "processed",
      };

      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue({
        refund: processedRefund,
        allocations: [],
      } as any);
      vi.spyOn(refundRepository, "lockRefund").mockResolvedValue(processedRefund as any);
      const updateSpy = vi.spyOn(refundRepository, "update");

      const result = await refundService.processProviderWebhookEvent({
        event: "refund.failed",
        refund: {
          id: "rfnd_999",
          payment_id: "pay_rzp_200",
          amount: 15_000,
          currency: "INR",
          status: "failed",
        },
      });

      expect(result).toMatchObject({ duplicate: false, ignoredStale: true });
      expect(updateSpy).not.toHaveBeenCalled();
      expect(auditService.write).not.toHaveBeenCalled();
    });

    it("out-of-order protection: ignores refund.created received after refund is already processed", async () => {
      const processedRefund = {
        ...sampleRefund,
        status: "processed" as const,
        providerRefundId: "rfnd_999",
        providerStatus: "processed",
      };

      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue({
        refund: processedRefund,
        allocations: [],
      } as any);
      vi.spyOn(refundRepository, "lockRefund").mockResolvedValue(processedRefund as any);
      const updateSpy = vi.spyOn(refundRepository, "update");

      const result = await refundService.processProviderWebhookEvent({
        event: "refund.created",
        refund: {
          id: "rfnd_999",
          payment_id: "pay_rzp_200",
          amount: 15_000,
          currency: "INR",
          status: "pending",
        },
      });

      expect(result).toMatchObject({ duplicate: false, ignoredStale: true });
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it("rejects amount mismatch with 409 PAYMENT_PROVIDER_MISMATCH", async () => {
      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue(undefined);
      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: { ...sampleRefund },
        allocations: [],
      } as any);

      await expect(
        refundService.processProviderWebhookEvent({
          event: "refund.processed",
          refund: {
            id: "rfnd_999",
            payment_id: "pay_rzp_200",
            amount: 99_999,
            currency: "INR",
            status: "processed",
            receipt: "refund_42_v3",
          },
        })
      ).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_PROVIDER_MISMATCH",
      });
    });
  });

  describe("reconcileStaleRefunds fallback", () => {
    it("reconciles stuck submitted refund using provider gateway receipt lookup", async () => {
      const adminPrincipal = {
        userId: 1,
        email: "admin@pizza.store",
        platformRole: "admin" as const,
        tokenVersion: 1,
      };

      vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({
        access: "membership",
        userId: 1,
        storeId: 1,
        permission: "finance.refunds.approve",
        membershipRole: "manager",
      });

      const staleCandidate = {
        ...sampleRefund,
        updatedAt: new Date("2026-09-01T09:00:00Z"),
      };

      vi.spyOn(refundRepository, "findStaleCandidates").mockResolvedValue([staleCandidate] as any);
      vi.spyOn(refundRepository, "findByProviderRefundId").mockResolvedValue(undefined);
      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: staleCandidate,
        allocations: [],
      } as any);

      const mockGateway = {
        findRefundByReceipt: vi.fn().mockResolvedValue({
          id: "rfnd_reconciled_123",
          paymentId: "pay_rzp_200",
          amountPaise: 15_000,
          currency: "INR",
          status: "processed",
          receipt: "refund_42_v3",
        }),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      const updateSpy = vi.spyOn(refundRepository, "update").mockImplementation(async (_tx, id, patch) => ({
        ...staleCandidate,
        ...patch,
        id,
      } as any));

      const result = await refundService.reconcileStaleRefunds(adminPrincipal, {
        storeId: 1,
        olderThanMinutes: 15,
        limit: 10,
      });

      expect(result).toMatchObject({
        checked: 1,
        processed: 1,
        failed: 0,
        unchanged: 0,
      });
      expect(mockGateway.findRefundByReceipt).toHaveBeenCalledWith("pay_rzp_200", "refund_42_v3");
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        42,
        expect.objectContaining({
          status: "processed",
          providerRefundId: "rfnd_reconciled_123",
        })
      );
    });

    it("leaves candidate unchanged if provider has no matching record yet", async () => {
      const adminPrincipal = {
        userId: 1,
        email: "admin@pizza.store",
        platformRole: "admin" as const,
        tokenVersion: 1,
      };

      vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({
        access: "membership",
        userId: 1,
        storeId: 1,
        permission: "finance.refunds.approve",
        membershipRole: "manager",
      });

      const staleCandidate = {
        ...sampleRefund,
        updatedAt: new Date("2026-09-01T09:00:00Z"),
      };

      vi.spyOn(refundRepository, "findStaleCandidates").mockResolvedValue([staleCandidate] as any);
      vi.spyOn(refundRepository, "findById").mockResolvedValue({
        refund: staleCandidate,
        allocations: [],
      } as any);

      const mockGateway = {
        findRefundByReceipt: vi.fn().mockResolvedValue(null),
      };
      vi.spyOn(razorpayGateway, "createRazorpayGateway").mockReturnValue(mockGateway as any);

      const result = await refundService.reconcileStaleRefunds(adminPrincipal, {
        storeId: 1,
        olderThanMinutes: 15,
      });

      expect(result).toMatchObject({
        checked: 1,
        processed: 0,
        unchanged: 1,
      });
    });
  });

  describe("visibility into stuck and failed refunds", () => {
    it("listStuck computes cutoff and calls repository with stuckCutoff", async () => {
      const managerPrincipal = {
        userId: 2,
        email: "mgr@store1.com",
        platformRole: "user" as const,
        tokenVersion: 1,
      };

      vi.spyOn(authorizationService, "requireStorePermission").mockResolvedValue({
        access: "membership",
        userId: 2,
        storeId: 1,
        permission: "finance.refunds.create",
        membershipRole: "manager",
      });

      const listSpy = vi.spyOn(refundRepository, "list").mockResolvedValue({
        items: [sampleRefund] as any,
        meta: { total: 1, page: 1, limit: 25, totalPages: 1, hasNextPage: false },
      });

      const result = await refundService.listStuck(managerPrincipal, {
        storeId: 1,
        olderThanMinutes: 30,
        page: 1,
        limit: 25,
      });

      expect(result.items).toHaveLength(1);
      expect(listSpy).toHaveBeenCalledWith(
        1,
        undefined,
        1,
        25,
        expect.objectContaining({
          stuckCutoff: expect.any(Date),
        })
      );
    });
  });
});
