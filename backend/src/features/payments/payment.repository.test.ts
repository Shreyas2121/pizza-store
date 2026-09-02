import { describe, expect, it, vi } from "vitest";
import paymentRepository from "./payment.repository";
import type { PaymentAttempt } from "../../db/schema/payment-attempt.schema";

describe("PaymentRepository — Payment Attempts", () => {
  const sampleAttemptRecord: PaymentAttempt = {
    id: 42,
    orderId: 100,
    storeId: 1,
    provider: "razorpay",
    method: "upi",
    status: "captured",
    providerStatus: "captured",
    amountPaise: 49900,
    currency: "INR",
    providerOrderId: "order_rzp_123",
    providerPaymentId: "pay_rzp_456",
    clientRequestId: "req-uuid-1",
    failureCode: null,
    failureDescription: null,
    authorizedAt: new Date("2026-09-02T10:00:00Z"),
    capturedAt: new Date("2026-09-02T10:01:00Z"),
    failedAt: null,
    expiresAt: new Date("2026-09-02T10:30:00Z"),
    createdAt: new Date("2026-09-02T10:00:00Z"),
    updatedAt: new Date("2026-09-02T10:01:00Z"),
  };

  const sampleOrder = {
    id: 100,
    userId: 7,
    grandTotalPaise: 49900,
    couponId: null,
  };

  const sampleStore = {
    id: 1,
    name: "Indiranagar Store",
  };

  describe("toAttemptDTO", () => {
    it("converts raw database record into typed PaymentAttemptDTO", () => {
      const dto = paymentRepository.toAttemptDTO(sampleAttemptRecord);

      expect(dto).toEqual({
        id: 42,
        orderId: 100,
        storeId: 1,
        provider: "razorpay",
        method: "upi",
        status: "captured",
        providerStatus: "captured",
        amountPaise: 49900,
        currency: "INR",
        providerOrderId: "order_rzp_123",
        providerPaymentId: "pay_rzp_456",
        clientRequestId: "req-uuid-1",
        failureCode: null,
        failureDescription: null,
        authorizedAt: sampleAttemptRecord.authorizedAt,
        capturedAt: sampleAttemptRecord.capturedAt,
        failedAt: null,
        expiresAt: sampleAttemptRecord.expiresAt,
        createdAt: sampleAttemptRecord.createdAt,
        updatedAt: sampleAttemptRecord.updatedAt,
      });
    });
  });

  describe("toLocalRazorpayAttempt (compatibility adapter)", () => {
    it("maps captured status to completed for legacy consumers", () => {
      const legacy = paymentRepository.toLocalRazorpayAttempt(
        sampleAttemptRecord,
        sampleOrder,
        sampleStore
      );

      expect(legacy).toEqual({
        localOrderId: 100,
        localPaymentId: 42,
        userId: 7,
        storeId: 1,
        storeName: "Indiranagar Store",
        grandTotalPaise: 49900,
        couponId: null,
        provider: "razorpay",
        amountPaise: 49900,
        currency: "INR",
        status: "completed",
        providerStatus: "captured",
        providerOrderId: "order_rzp_123",
        failureCode: null,
        failureDescription: null,
      });
    });

    it("maps failed, cancelled, expired, voided statuses to failed", () => {
      for (const terminalFailure of ["failed", "cancelled", "expired", "voided"] as const) {
        const legacy = paymentRepository.toLocalRazorpayAttempt(
          { ...sampleAttemptRecord, status: terminalFailure },
          sampleOrder,
          sampleStore
        );
        expect(legacy.status).toBe("failed");
      }
    });

    it("maps processing and authorized statuses to processing", () => {
      for (const inFlight of ["processing", "authorized"] as const) {
        const legacy = paymentRepository.toLocalRazorpayAttempt(
          { ...sampleAttemptRecord, status: inFlight },
          sampleOrder,
          sampleStore
        );
        expect(legacy.status).toBe("processing");
      }
    });

    it("maps pending status to pending", () => {
      const legacy = paymentRepository.toLocalRazorpayAttempt(
        { ...sampleAttemptRecord, status: "pending" },
        sampleOrder,
        sampleStore
      );
      expect(legacy.status).toBe("pending");
    });
  });

  describe("Database queries with mock transaction executor", () => {
    it("createPaymentAttempt calls executor.insert.values.returning", async () => {
      const mockReturning = vi.fn().mockResolvedValue([sampleAttemptRecord]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      const mockTx: any = { insert: mockInsert };

      const result = await paymentRepository.createPaymentAttempt(
        {
          orderId: 100,
          storeId: 1,
          provider: "razorpay",
          amountPaise: 49900,
        },
        mockTx
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 100, storeId: 1 })
      );
      expect(result).toEqual(sampleAttemptRecord);
    });

    it("updatePaymentAttempt calls executor.update.set.where.returning", async () => {
      const updatedRecord = { ...sampleAttemptRecord, status: "authorized" as const };
      const mockReturning = vi.fn().mockResolvedValue([updatedRecord]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      const mockTx: any = { update: mockUpdate };

      const result = await paymentRepository.updatePaymentAttempt(
        { status: "authorized" },
        42,
        mockTx
      );

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ status: "authorized" });
      expect(result).toEqual(updatedRecord);
    });

    it("getPaymentAttemptById returns mapped DTO when found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([sampleAttemptRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockTx: any = { select: mockSelect };

      const result = await paymentRepository.getPaymentAttemptById(42, mockTx);

      expect(result).toBeDefined();
      expect(result?.id).toBe(42);
      expect(result?.status).toBe("captured");
    });

    it("getPaymentAttemptById returns undefined when record not found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockTx: any = { select: mockSelect };

      const result = await paymentRepository.getPaymentAttemptById(999, mockTx);

      expect(result).toBeUndefined();
    });

    it("getAttemptsByOrderId returns array of DTOs sorted by creation date", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([sampleAttemptRecord]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockTx: any = { select: mockSelect };

      const results = await paymentRepository.getAttemptsByOrderId(100, mockTx);

      expect(results).toHaveLength(1);
      expect(results[0].orderId).toBe(100);
    });

    it("getPaymentAttemptByProviderOrderId returns DTO when found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([sampleAttemptRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockTx: any = { select: mockSelect };

      const result = await paymentRepository.getPaymentAttemptByProviderOrderId(
        "order_rzp_123",
        mockTx
      );

      expect(result).toBeDefined();
      expect(result?.providerOrderId).toBe("order_rzp_123");
    });

    it("getPaymentAttemptByClientRequestId returns DTO when found", async () => {
      const mockLimit = vi.fn().mockResolvedValue([sampleAttemptRecord]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      const mockTx: any = { select: mockSelect };

      const result = await paymentRepository.getPaymentAttemptByClientRequestId(
        "req-uuid-1",
        mockTx
      );

      expect(result).toBeDefined();
      expect(result?.clientRequestId).toBe("req-uuid-1");
    });
  });
});
