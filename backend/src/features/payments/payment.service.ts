import { createHmac, timingSafeEqual } from "crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, storesTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import type { TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import {
  getRazorpayConfig,
  isRazorpayCheckoutEnabled,
} from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type {
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
} from "./razorpay.types";

const MIN_RAZORPAY_AMOUNT_PAISE = 100;

interface InitiateRazorpayOrderInput {
  userId: number;
  addressId: number;
  couponCode?: string | null;
  clientRequestId: string;
}

interface VerifyRazorpayPaymentInput {
  userId: number;
  localOrderId: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface FinalizeCapturedPaymentInput {
  localOrderId: number;
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
  providerStatus: "captured";
  userId?: number;
}

interface LocalRazorpayAttempt {
  localOrderId: number;
  localPaymentId: number;
  userId: number;
  storeId: number;
  storeName: string;
  totalPrice: number;
  couponId: number | null;
  provider: "cod" | "razorpay";
  amountPaise: number;
  currency: "INR";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  providerStatus: string | null;
  providerOrderId: string | null;
  failureCode: string | null;
  failureDescription: string | null;
}

class PaymentService {
  async createPayment(
    data: typeof paymentsTable.$inferInsert,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    const [payment] = await dbT
      .insert(paymentsTable)
      .values(data)
      .returning();
    return payment;
  }

  async updatePayment(
    data: Partial<typeof paymentsTable.$inferInsert>,
    id: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    await dbT.update(paymentsTable).set(data).where(eq(paymentsTable.id, id));
  }

  async initiateRazorpayOrder(data: InitiateRazorpayOrderInput) {
    if (!isRazorpayCheckoutEnabled()) {
      throw new AppError(
        "Online payment is currently disabled. Choose cash on delivery.",
        503,
        "ONLINE_PAYMENT_DISABLED"
      );
    }
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.findOrCreateLocalAttempt(data);
    return await this.ensureProviderOrder(attempt, config);
  }

  async retryRazorpayOrder(localOrderId: number, userId: number) {
    if (!isRazorpayCheckoutEnabled()) {
      throw new AppError(
        "Online payment is currently disabled. Existing payments will still be reconciled.",
        503,
        "ONLINE_PAYMENT_DISABLED"
      );
    }
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.getAttemptByOrderId(localOrderId);
    if (!attempt || attempt.userId !== userId) {
      throw new AppError("Payment order not found", 404);
    }
    if (attempt.provider !== "razorpay") {
      throw new AppError("Online payment order not found", 404);
    }

    const retryableAttempt =
      attempt.status === "failed" && attempt.providerOrderId
        ? await this.reactivateProviderOrder(attempt)
        : attempt;
    return await this.ensureProviderOrder(retryableAttempt, config);
  }

  async getRazorpayOrderStatus(localOrderId: number, userId: number) {
    const attempt = await this.getAttemptByOrderId(localOrderId);
    if (!attempt || attempt.userId !== userId) {
      throw new AppError("Payment order not found", 404);
    }
    if (attempt.provider !== "razorpay") {
      throw new AppError("Online payment order not found", 404);
    }
    return this.toCheckoutResponse(
      attempt,
      isRazorpayCheckoutEnabled() ? getRazorpayConfig()?.keyId ?? null : null
    );
  }

  async verifyRazorpayPayment(data: VerifyRazorpayPaymentInput) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.getAttemptByOrderId(data.localOrderId);
    if (
      !attempt ||
      attempt.userId !== data.userId ||
      attempt.provider !== "razorpay"
    ) {
      throw new AppError("Payment order not found", 404);
    }
    if (!attempt.providerOrderId) {
      throw new AppError(
        "Payment order is not ready for verification",
        409,
        "PAYMENT_ORDER_NOT_READY"
      );
    }
    if (data.razorpayOrderId !== attempt.providerOrderId) {
      throw new AppError(
        "Payment order does not match",
        400,
        "PAYMENT_ORDER_MISMATCH"
      );
    }
    if (
      !this.isValidCheckoutSignature(
        attempt.providerOrderId,
        data.razorpayPaymentId,
        data.razorpaySignature,
        config.keySecret
      )
    ) {
      throw new AppError(
        "Payment signature is invalid",
        400,
        "PAYMENT_SIGNATURE_INVALID"
      );
    }

    const result = await this.reconcileProviderPayment(
      attempt.providerOrderId,
      data.razorpayPaymentId,
      { userId: data.userId, requireCaptured: true }
    );
    if ("ignored" in result || !("totalPrice" in result)) {
      throw new AppError("Payment order not found", 404);
    }
    return result;
  }

  async reconcileProviderPayment(
    providerOrderId: string,
    providerPaymentId: string,
    options: {
      userId?: number;
      requireCaptured?: boolean;
      failureCode?: string | null;
      failureDescription?: string | null;
    } = {}
  ) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await this.getAttemptByProviderOrderId(providerOrderId);
    if (!attempt || (options.userId !== undefined && attempt.userId !== options.userId)) {
      if (options.userId !== undefined) {
        throw new AppError("Payment order not found", 404);
      }
      logger.warn("Ignoring Razorpay event for an unknown provider order", {
        providerOrderId,
        providerPaymentId,
      });
      return { ignored: true as const, finalizedNow: false };
    }

    const gateway = createRazorpayGateway(config);
    let providerPayment: RazorpayPaymentSnapshot;
    let providerOrder: RazorpayOrderSnapshot;
    try {
      [providerPayment, providerOrder] = await Promise.all([
        gateway.fetchPayment(providerPaymentId),
        gateway.fetchOrder(providerOrderId),
      ]);

      // A failed event can arrive after another attempt captured the order.
      // Resolve the captured attempt before applying any failure transition.
      if (providerPayment.status === "failed") {
        const payments = await gateway.fetchOrderPayments(providerOrderId);
        providerPayment =
          payments.find((payment) => payment.status === "captured") ??
          payments.find((payment) => payment.status === "authorized") ??
          providerPayment;
      }
    } catch (error) {
      logger.error("Could not fetch Razorpay state during reconciliation", {
        localOrderId: attempt.localOrderId,
        localPaymentId: attempt.localPaymentId,
        providerOrderId,
        providerPaymentId,
        error: error instanceof Error ? error.message : "Provider fetch failed",
      });
      throw new AppError(
        "Could not confirm payment status. Please try again",
        502,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        {
          localOrderId: attempt.localOrderId,
          localPaymentId: attempt.localPaymentId,
        }
      );
    }

    this.assertProviderStateMatches(attempt, providerPayment, providerOrder);

    if (
      providerPayment.status === "captured" &&
      providerOrder.status === "paid"
    ) {
      if (
        providerOrder.amountPaidPaise !== attempt.amountPaise ||
        providerOrder.amountDuePaise !== 0
      ) {
        throw new AppError(
          "Paid amount does not match the order",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }
      return await this.finalizeCapturedPayment({
        userId: options.userId,
        localOrderId: attempt.localOrderId,
        providerOrderId: providerOrder.id,
        providerPaymentId: providerPayment.id,
        amountPaise: providerPayment.amountPaise,
        currency: providerPayment.currency,
        providerStatus: providerPayment.status,
      });
    }

    if (options.requireCaptured) {
      throw new AppError(
        "Payment has not been captured yet",
        409,
        "PAYMENT_NOT_CAPTURED",
        {
          localOrderId: attempt.localOrderId,
          localPaymentId: attempt.localPaymentId,
          paymentStatus: providerPayment.status,
          orderStatus: providerOrder.status,
        }
      );
    }

    if (providerPayment.status === "failed") {
      return await this.markProviderPaymentFailed(attempt, providerPayment, {
        code: options.failureCode,
        description: options.failureDescription,
      });
    }

    await this.recordProviderObservation(attempt, providerPayment.status);
    return {
      localOrderId: attempt.localOrderId,
      localPaymentId: attempt.localPaymentId,
      paymentStatus: attempt.status,
      orderStatus: "awaiting_payment" as const,
      finalizedNow: false,
    };
  }

  async finalizeCapturedPayment(data: FinalizeCapturedPaymentInput) {
    return await db.transaction(async (tx) => {
      const [record] = await tx
        .select({ order: ordersTable, payment: paymentsTable })
        .from(ordersTable)
        .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
        .where(eq(ordersTable.id, data.localOrderId))
        .for("update")
        .limit(1);

      if (
        !record ||
        (data.userId !== undefined && record.order.userId !== data.userId) ||
        record.payment.provider !== "razorpay"
      ) {
        throw new AppError("Payment order not found", 404);
      }
      if (
        record.payment.providerOrderId !== data.providerOrderId ||
        record.payment.amountPaise !== data.amountPaise ||
        record.payment.currency !== data.currency
      ) {
        throw new AppError(
          "Payment details do not match the order",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }

      if (
        record.payment.status === "completed" ||
        record.payment.status === "refunded"
      ) {
        if (record.payment.providerPaymentId !== data.providerPaymentId) {
          throw new AppError(
            "Order was finalized with a different payment",
            409,
            "PAYMENT_ALREADY_COMPLETED"
          );
        }
        return {
          localOrderId: record.order.id,
          localPaymentId: record.payment.id,
          totalPrice: record.order.totalPrice,
          paymentStatus: record.payment.status,
          orderStatus: record.order.status,
          finalizedNow: false,
        };
      }

      if (record.order.status !== "awaiting_payment") {
        throw new AppError(
          "Order is no longer eligible for payment finalization",
          409,
          "PAYMENT_ORDER_NOT_PAYABLE"
        );
      }

      const [paymentUsingProviderId] = await tx
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(eq(paymentsTable.providerPaymentId, data.providerPaymentId))
        .limit(1);
      if (
        paymentUsingProviderId &&
        paymentUsingProviderId.id !== record.payment.id
      ) {
        throw new AppError(
          "Provider payment is already linked to another order",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }

      await inventoryService.consumeReservationsForOrder(record.order.id, tx);

      const paidAt = new Date();
      await this.updatePayment(
        {
          status: "completed",
          providerStatus: data.providerStatus,
          providerPaymentId: data.providerPaymentId,
          paidAt,
          paymentDate: paidAt,
          failedAt: null,
          failureCode: null,
          failureDescription: null,
        },
        record.payment.id,
        tx
      );
      await tx
        .update(ordersTable)
        .set({ status: "pending" })
        .where(eq(ordersTable.id, record.order.id));

      if (record.order.couponId) {
        await checkoutService.consumeCouponReservation(
          {
            couponId: record.order.couponId,
            orderId: record.order.id,
            userId: record.order.userId,
          },
          tx
        );
      }

      return {
        localOrderId: record.order.id,
        localPaymentId: record.payment.id,
        totalPrice: record.order.totalPrice,
        paymentStatus: "completed" as const,
        orderStatus: "pending" as const,
        finalizedNow: true,
      };
    });
  }

  async reconcileStalePayments(olderThanMinutes: number, limit: number) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }
    const gateway = createRazorpayGateway(config);
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const candidates = await this.selectAttempts()
      .where(
        and(
          eq(paymentsTable.provider, "razorpay"),
          inArray(paymentsTable.status, ["processing", "failed"]),
          lt(paymentsTable.updatedAt, cutoff)
        )
      )
      .limit(limit);

    const results: Array<{
      providerOrderId: string | null;
      status: "finalized" | "failed" | "unchanged" | "error";
      localOrderId?: number;
      totalPrice?: number;
      finalizedNow?: boolean;
      error?: string;
    }> = [];

    for (const candidate of candidates) {
      try {
        let providerOrderId = candidate.providerOrderId;
        if (!providerOrderId) {
          const recoveredOrder = await gateway.findOrderByReceipt(
            this.buildReceipt(candidate)
          );
          if (!recoveredOrder) {
            results.push({
              providerOrderId: null,
              localOrderId: candidate.localOrderId,
              status: "unchanged",
              finalizedNow: false,
            });
            continue;
          }
          if (
            recoveredOrder.amountPaise !== candidate.amountPaise ||
            recoveredOrder.currency !== candidate.currency ||
            recoveredOrder.receipt !== this.buildReceipt(candidate)
          ) {
            throw new AppError(
              "Recovered provider order does not match local payment",
              409,
              "PAYMENT_PROVIDER_MISMATCH"
            );
          }
          providerOrderId = recoveredOrder.id;
          await this.attachRecoveredProviderOrder(candidate, recoveredOrder);
          logger.warn("Recovered an unattached Razorpay order by receipt", {
            localOrderId: candidate.localOrderId,
            localPaymentId: candidate.localPaymentId,
            providerOrderId,
          });
        }

        const result = await this.reconcileProviderOrder(providerOrderId);
        results.push({
          providerOrderId,
          status: result.finalizedNow
            ? "finalized"
            : "paymentStatus" in result && result.paymentStatus === "failed"
              ? "failed"
              : "unchanged",
          ...("localOrderId" in result && result.localOrderId
            ? { localOrderId: result.localOrderId }
            : {}),
          ...("totalPrice" in result && result.totalPrice !== undefined
            ? { totalPrice: result.totalPrice }
            : {}),
          finalizedNow: result.finalizedNow,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
        logger.error("Stale Razorpay payment reconciliation failed", {
          providerOrderId: candidate.providerOrderId,
          localOrderId: candidate.localOrderId,
          error: message,
        });
        results.push({
          providerOrderId: candidate.providerOrderId,
          localOrderId: candidate.localOrderId,
          status: "error",
          error: message,
        });
      }
    }

    return {
      checked: candidates.length,
      finalized: results.filter((result) => result.status === "finalized").length,
      failed: results.filter((result) => result.status === "failed").length,
      errors: results.filter((result) => result.status === "error").length,
      results,
    };
  }

  async reconcileExpiredReservations(limit = 25) {
    const orderIds =
      await inventoryService.getExpiredActiveReservationOrderIds(limit);

    const results: Array<{
      orderId: number;
      status: "finalized" | "released" | "skipped" | "conflict" | "error";
      error?: string;
    }> = [];

    const config = getRazorpayConfig();

    for (const orderId of orderIds) {
      try {
        const attempt = await this.getAttemptByOrderId(orderId);
        if (!attempt) {
          await db.transaction(async (tx) => {
            await inventoryService.releaseReservations(orderId, tx);
          });
          results.push({ orderId, status: "released" });
          continue;
        }

        if (attempt.status === "completed" || attempt.status === "refunded") {
          results.push({ orderId, status: "skipped" });
          continue;
        }

        if (attempt.providerOrderId && config) {
          const gateway = createRazorpayGateway(config);
          let providerOrder: RazorpayOrderSnapshot | null = null;
          let providerPayments: RazorpayPaymentSnapshot[] = [];
          try {
            [providerOrder, providerPayments] = await Promise.all([
              gateway.fetchOrder(attempt.providerOrderId),
              gateway.fetchOrderPayments(attempt.providerOrderId),
            ]);
          } catch (err) {
            logger.warn(
              "Could not fetch Razorpay order status during reservation expiry",
              {
                orderId,
                providerOrderId: attempt.providerOrderId,
                error: err instanceof Error ? err.message : "Provider error",
              }
            );
          }

          const captured = providerPayments.find(
            (p) => p.status === "captured" || p.status === "authorized"
          );

          if (captured && providerOrder?.status === "paid") {
            const res = await this.reconcileProviderPayment(
              attempt.providerOrderId,
              captured.id,
              { requireCaptured: true }
            );
            if (res.finalizedNow) {
              results.push({ orderId, status: "finalized" });
              continue;
            }
          }
        }

        // Release expired reservations and cancel awaiting_payment order atomically
        await db.transaction(async (tx) => {
          const [order] = await tx
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, orderId))
            .for("update")
            .limit(1);

          if (!order || order.status !== "awaiting_payment") {
            return;
          }

          const [payment] = await tx
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.id, attempt.localPaymentId))
            .for("update")
            .limit(1);

          if (payment && payment.status === "pending") {
            await this.updatePayment(
              {
                status: "failed",
                failureCode: "RESERVATION_EXPIRED",
                failureDescription:
                  "Payment reservation expired before completion",
                failedAt: new Date(),
              },
              payment.id,
              tx
            );
          }

          await tx
            .update(ordersTable)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(ordersTable.id, orderId));

          await inventoryService.releaseReservations(orderId, tx);
          if (attempt.couponId) {
            await checkoutService.releaseCouponReservation(orderId, tx);
          }
        });

        results.push({ orderId, status: "released" });
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
        logger.error("Expired reservation reconciliation error", {
          orderId,
          error: message,
        });
        results.push({ orderId, status: "error", error: message });
      }
    }

    return {
      scanned: orderIds.length,
      finalized: results.filter((r) => r.status === "finalized").length,
      released: results.filter((r) => r.status === "released").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      conflicts: results.filter((r) => r.status === "conflict").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    };
  }

  async reconcileProviderOrder(providerOrderId: string) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }
    const attempt = await this.getAttemptByProviderOrderId(providerOrderId);
    if (!attempt) {
      return { ignored: true as const, finalizedNow: false };
    }

    const gateway = createRazorpayGateway(config);
    const [providerOrder, providerPayments] = await Promise.all([
      gateway.fetchOrder(providerOrderId),
      gateway.fetchOrderPayments(providerOrderId),
    ]);
    const providerPayment =
      providerPayments.find((payment) => payment.status === "captured") ??
      providerPayments.find((payment) => payment.status === "authorized") ??
      providerPayments.find((payment) => payment.status === "failed") ??
      providerPayments[0];

    if (!providerPayment) {
      if (
        providerOrder.id !== attempt.providerOrderId ||
        providerOrder.amountPaise !== attempt.amountPaise ||
        providerOrder.currency !== attempt.currency
      ) {
        throw new AppError(
          "Provider order does not match the local payment",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }
      await this.recordProviderObservation(attempt, providerOrder.status);
      return {
        localOrderId: attempt.localOrderId,
        localPaymentId: attempt.localPaymentId,
        paymentStatus: attempt.status,
        orderStatus: "awaiting_payment" as const,
        finalizedNow: false,
      };
    }

    return await this.reconcileProviderPayment(
      providerOrderId,
      providerPayment.id
    );
  }

  private async findOrCreateLocalAttempt(data: InitiateRazorpayOrderInput) {
    const existing = await this.getAttemptByClientRequestId(data.clientRequestId);
    if (existing) {
      if (existing.userId !== data.userId) {
        throw new AppError(
          "Client request ID has already been used",
          409,
          "PAYMENT_REQUEST_CONFLICT"
        );
      }
      return existing;
    }

    try {
      return await db.transaction(async (tx) => {
        const quote = await checkoutService.buildQuote(data, tx);
        if (quote.totalPaise < MIN_RAZORPAY_AMOUNT_PAISE) {
          throw new AppError(
            "Online payment amount must be at least ₹1.00",
            400,
            "PAYMENT_AMOUNT_TOO_LOW"
          );
        }

        const payment = await this.createPayment(
          {
            provider: "razorpay",
            status: "pending",
            amountPaise: quote.totalPaise,
            currency: "INR",
            clientRequestId: data.clientRequestId,
          },
          tx
        );
        const order = await checkoutService.createOrderSnapshot(
          quote,
          {
            userId: data.userId,
            addressId: data.addressId,
            paymentId: payment.id,
            paymentType: "razorpay",
            status: "awaiting_payment",
          },
          tx
        );

        await inventoryService.reserveStockForOrder(
          {
            orderId: order.id,
            storeId: order.storeId,
            allocations: quote.stockAllocations,
          },
          tx
        );

        if (quote.coupon) {
          await checkoutService.recordCouponUse(
            {
              couponId: quote.coupon.id,
              orderId: order.id,
              userId: data.userId,
              status: "reserved",
            },
            tx
          );
        }

        // The order contains a durable item snapshot, so the cart can be
        // cleared without losing the customer's recoverable payment attempt.
        await cartService.clearCart(data.userId, tx);

        return {
          localOrderId: order.id,
          localPaymentId: payment.id,
          userId: order.userId,
          storeId: order.storeId,
          storeName: quote.cart.store!.name,
          totalPrice: order.totalPrice,
          couponId: order.couponId,
          provider: payment.provider,
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          status: payment.status,
          providerStatus: payment.providerStatus,
          providerOrderId: payment.providerOrderId,
          failureCode: payment.failureCode,
          failureDescription: payment.failureDescription,
        } satisfies LocalRazorpayAttempt;
      });
    } catch (error) {
      // A concurrent request with the same idempotency key can win the unique
      // insert. Resolve that race to its durable attempt instead of surfacing a
      // database constraint error.
      const concurrentAttempt = await this.getAttemptByClientRequestId(
        data.clientRequestId
      );
      if (concurrentAttempt?.userId === data.userId) return concurrentAttempt;
      throw error;
    }
  }

  private async ensureProviderOrder(
    attempt: LocalRazorpayAttempt,
    config: { keyId: string; keySecret: string }
  ) {
    if (attempt.providerOrderId || attempt.status === "completed") {
      return this.toCheckoutResponse(attempt, config.keyId);
    }

    const claim = await this.claimProviderOrderCreation(attempt);
    if (!claim.claimed) {
      return this.toCheckoutResponse(claim.attempt, config.keyId);
    }

    const gateway = createRazorpayGateway(config);
    let providerOrder: RazorpayOrderSnapshot;
    try {
      providerOrder = await gateway.createOrder({
        amountPaise: claim.attempt.amountPaise,
        currency: claim.attempt.currency,
        receipt: this.buildReceipt(claim.attempt),
        notes: {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
          storeId: claim.attempt.storeId,
        },
      });
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Provider request failed";
      await this.markProviderCreationFailed(
        claim.attempt,
        "RAZORPAY_ORDER_CREATE_FAILED",
        "Razorpay could not create the payment order"
      );
      logger.error("Razorpay order creation failed", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        error: description,
      });
      throw new AppError(
        "Could not start online payment. Please retry",
        502,
        "PAYMENT_INIT_FAILED",
        {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
        }
      );
    }

    if (
      providerOrder.amountPaise !== claim.attempt.amountPaise ||
      providerOrder.currency !== claim.attempt.currency ||
      providerOrder.status !== "created"
    ) {
      await this.markProviderCreationFailed(
        claim.attempt,
        "RAZORPAY_ORDER_MISMATCH",
        "Provider order did not match the local payment"
      );
      logger.error("Razorpay returned a mismatched order", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        providerOrderId: providerOrder.id,
      });
      throw new AppError(
        "Online payment could not be prepared safely",
        502,
        "PAYMENT_PROVIDER_MISMATCH",
        {
          localOrderId: claim.attempt.localOrderId,
          localPaymentId: claim.attempt.localPaymentId,
        }
      );
    }

    try {
      const saved = await db.transaction(async (tx) => {
        const [lockedPayment] = await tx
          .select()
          .from(paymentsTable)
          .where(eq(paymentsTable.id, claim.attempt.localPaymentId))
          .for("update")
          .limit(1);

        if (!lockedPayment) throw new AppError("Payment not found", 404);
        if (
          lockedPayment.providerOrderId &&
          lockedPayment.providerOrderId !== providerOrder.id
        ) {
          throw new AppError("Payment already has a different provider order", 409);
        }

        await this.updatePayment(
          {
            status: "processing",
            providerStatus: providerOrder.status,
            providerOrderId: providerOrder.id,
            failureCode: null,
            failureDescription: null,
            failedAt: null,
          },
          lockedPayment.id,
          tx
        );

        return {
          ...claim.attempt,
          status: "processing" as const,
          providerStatus: providerOrder.status,
          providerOrderId: providerOrder.id,
          failureCode: null,
          failureDescription: null,
        };
      });
      return this.toCheckoutResponse(saved, config.keyId);
    } catch (error) {
      logger.error("Razorpay order was created but could not be persisted", {
        localOrderId: claim.attempt.localOrderId,
        localPaymentId: claim.attempt.localPaymentId,
        providerOrderId: providerOrder.id,
        error: error instanceof Error ? error.message : "Persistence failed",
      });
      throw error;
    }
  }

  private async claimProviderOrderCreation(attempt: LocalRazorpayAttempt) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);

      if (!payment) throw new AppError("Payment not found", 404);
      const current = { ...attempt, ...this.paymentFields(payment) };
      if (
        payment.providerOrderId ||
        payment.status === "processing" ||
        payment.status === "completed" ||
        payment.status === "refunded"
      ) {
        return { claimed: false as const, attempt: current };
      }

      if (payment.status === "failed" && attempt.couponId) {
        await checkoutService.restoreCouponReservation(
          { couponId: attempt.couponId, orderId: attempt.localOrderId },
          tx
        );
      }

      await this.updatePayment(
        {
          status: "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
        },
        payment.id,
        tx
      );
      return {
        claimed: true as const,
        attempt: {
          ...current,
          status: "processing" as const,
          failureCode: null,
          failureDescription: null,
        },
      };
    });
  }

  private async markProviderCreationFailed(
    attempt: LocalRazorpayAttempt,
    failureCode: string,
    failureDescription: string
  ) {
    await db.transaction(async (tx) => {
      await this.updatePayment(
        {
          status: "failed",
          failureCode,
          failureDescription,
          failedAt: new Date(),
        },
        attempt.localPaymentId,
        tx
      );
      await checkoutService.releaseCouponReservation(attempt.localOrderId, tx);
      await inventoryService.releaseReservations(attempt.localOrderId, tx);
    });
  }

  private async reactivateProviderOrder(attempt: LocalRazorpayAttempt) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);

      if (!payment) throw new AppError("Payment not found", 404);
      const current = { ...attempt, ...this.paymentFields(payment) };
      if (payment.status !== "failed" || !payment.providerOrderId) {
        return current;
      }

      if (attempt.couponId) {
        await checkoutService.restoreCouponReservation(
          { couponId: attempt.couponId, orderId: attempt.localOrderId },
          tx
        );
      }
      await this.updatePayment(
        {
          status: "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
        },
        payment.id,
        tx
      );

      return {
        ...current,
        status: "processing" as const,
        failureCode: null,
        failureDescription: null,
      };
    });
  }

  private async attachRecoveredProviderOrder(
    attempt: LocalRazorpayAttempt,
    providerOrder: RazorpayOrderSnapshot
  ) {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);
      if (!payment) throw new AppError("Payment not found", 404);
      if (
        payment.providerOrderId &&
        payment.providerOrderId !== providerOrder.id
      ) {
        throw new AppError(
          "Payment already has a different provider order",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }
      if (payment.status === "failed" && attempt.couponId) {
        await checkoutService.restoreCouponReservation(
          { couponId: attempt.couponId, orderId: attempt.localOrderId },
          tx,
          false
        );
      }
      await this.updatePayment(
        {
          providerOrderId: providerOrder.id,
          providerStatus: providerOrder.status,
          status:
            payment.status === "completed" || payment.status === "refunded"
              ? payment.status
              : "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
        },
        payment.id,
        tx
      );
    });
  }

  private assertProviderStateMatches(
    attempt: LocalRazorpayAttempt,
    providerPayment: RazorpayPaymentSnapshot,
    providerOrder: RazorpayOrderSnapshot
  ) {
    if (
      providerPayment.orderId !== attempt.providerOrderId ||
      providerPayment.amountPaise !== attempt.amountPaise ||
      providerPayment.currency !== attempt.currency ||
      providerOrder.id !== attempt.providerOrderId ||
      providerOrder.amountPaise !== attempt.amountPaise ||
      providerOrder.currency !== attempt.currency
    ) {
      logger.error("Razorpay state did not match local payment", {
        localOrderId: attempt.localOrderId,
        localPaymentId: attempt.localPaymentId,
        providerOrderId: providerOrder.id,
        providerPaymentId: providerPayment.id,
      });
      throw new AppError(
        "Payment details do not match the order",
        409,
        "PAYMENT_PROVIDER_MISMATCH"
      );
    }
  }

  private async markProviderPaymentFailed(
    attempt: LocalRazorpayAttempt,
    providerPayment: RazorpayPaymentSnapshot,
    failure: { code?: string | null; description?: string | null }
  ) {
    return await db.transaction(async (tx) => {
      const [record] = await tx
        .select({ order: ordersTable, payment: paymentsTable })
        .from(ordersTable)
        .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
        .where(eq(ordersTable.id, attempt.localOrderId))
        .for("update")
        .limit(1);

      if (!record || record.payment.providerOrderId !== attempt.providerOrderId) {
        throw new AppError("Payment order not found", 404);
      }
      if (
        record.payment.status === "completed" ||
        record.payment.status === "refunded" ||
        record.order.status !== "awaiting_payment"
      ) {
        return {
          localOrderId: record.order.id,
          localPaymentId: record.payment.id,
          totalPrice: record.order.totalPrice,
          paymentStatus: record.payment.status,
          orderStatus: record.order.status,
          finalizedNow: false,
        };
      }

      await this.updatePayment(
        {
          status: "failed",
          providerStatus: "failed",
          providerPaymentId: providerPayment.id,
          failureCode: this.sanitizeProviderText(failure.code, "PAYMENT_FAILED"),
          failureDescription: this.sanitizeProviderText(
            failure.description,
            "Razorpay reported a failed payment"
          ),
          failedAt: new Date(),
        },
        record.payment.id,
        tx
      );
      await checkoutService.releaseCouponReservation(record.order.id, tx);
      await inventoryService.releaseReservations(record.order.id, tx);

      return {
        localOrderId: record.order.id,
        localPaymentId: record.payment.id,
        totalPrice: record.order.totalPrice,
        paymentStatus: "failed" as const,
        orderStatus: record.order.status,
        finalizedNow: false,
      };
    });
  }

  private async recordProviderObservation(
    attempt: LocalRazorpayAttempt,
    providerStatus: typeof paymentsTable.$inferInsert.providerStatus
  ) {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, attempt.localPaymentId))
        .for("update")
        .limit(1);
      if (
        !payment ||
        payment.status === "completed" ||
        payment.status === "refunded"
      ) {
        return;
      }
      await this.updatePayment({ providerStatus }, payment.id, tx);
    });
  }

  private sanitizeProviderText(value: string | null | undefined, fallback: string) {
    const normalized = value?.replace(/[\r\n\t]+/g, " ").trim();
    return (normalized || fallback).slice(0, 500);
  }

  private async getAttemptByClientRequestId(clientRequestId: string) {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.clientRequestId, clientRequestId))
      .limit(1);
    return attempt;
  }

  private async getAttemptByOrderId(localOrderId: number) {
    const [attempt] = await this.selectAttempts()
      .where(eq(ordersTable.id, localOrderId))
      .limit(1);
    return attempt;
  }

  private async getAttemptByProviderOrderId(providerOrderId: string) {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.providerOrderId, providerOrderId))
      .limit(1);
    return attempt;
  }

  private selectAttempts() {
    return db
      .select({
        localOrderId: ordersTable.id,
        localPaymentId: paymentsTable.id,
        userId: ordersTable.userId,
        storeId: ordersTable.storeId,
        storeName: storesTable.name,
        totalPrice: ordersTable.totalPrice,
        couponId: ordersTable.couponId,
        provider: paymentsTable.provider,
        amountPaise: paymentsTable.amountPaise,
        currency: paymentsTable.currency,
        status: paymentsTable.status,
        providerStatus: paymentsTable.providerStatus,
        providerOrderId: paymentsTable.providerOrderId,
        failureCode: paymentsTable.failureCode,
        failureDescription: paymentsTable.failureDescription,
      })
      .from(ordersTable)
      .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
      .innerJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
      .$dynamic();
  }

  private paymentFields(payment: typeof paymentsTable.$inferSelect) {
    return {
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      providerStatus: payment.providerStatus,
      providerOrderId: payment.providerOrderId,
      failureCode: payment.failureCode,
      failureDescription: payment.failureDescription,
    };
  }

  private buildReceipt(attempt: LocalRazorpayAttempt) {
    return `order_${attempt.localOrderId}_payment_${attempt.localPaymentId}`;
  }

  private isValidCheckoutSignature(
    providerOrderId: string,
    providerPaymentId: string,
    submittedSignature: string,
    keySecret: string
  ) {
    const expectedSignature = createHmac("sha256", keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest();
    const receivedSignature = Buffer.from(submittedSignature, "hex");

    return (
      receivedSignature.length === expectedSignature.length &&
      timingSafeEqual(receivedSignature, expectedSignature)
    );
  }

  private toCheckoutResponse(attempt: LocalRazorpayAttempt, keyId: string | null) {
    return {
      localOrderId: attempt.localOrderId,
      localPaymentId: attempt.localPaymentId,
      keyId,
      razorpayOrderId: attempt.providerOrderId,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      name: "PizzaStore",
      description: `Order from ${attempt.storeName}`,
      paymentStatus: attempt.status,
      providerStatus: attempt.providerStatus,
      checkoutReady: Boolean(
        keyId && attempt.providerOrderId && attempt.status === "processing"
      ),
      failure:
        attempt.status === "failed"
          ? {
              code: attempt.failureCode,
              description: attempt.failureDescription,
            }
          : null,
    };
  }
}

export default new PaymentService();
