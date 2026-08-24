import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import {
  buildPaymentReceipt,
  isValidCheckoutSignature,
  sanitizeProviderText,
} from "./payment.helpers";
import paymentRepository from "./payment.repository";
import {
  getRazorpayConfig,
} from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type {
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
} from "./razorpay.types";
import type {
  FinalizeCapturedPaymentInput,
  LocalRazorpayAttempt,
  VerifyRazorpayPaymentInput,
} from "./payment.types";

class PaymentReconciliationService {
  async verifyRazorpayPayment(data: VerifyRazorpayPaymentInput) {
    const config = getRazorpayConfig();
    if (!config) {
      throw new AppError(
        "Online payments are temporarily unavailable",
        503,
        "PAYMENT_UNAVAILABLE"
      );
    }

    const attempt = await paymentRepository.getAttemptByOrderId(
      data.localOrderId
    );
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
      !isValidCheckoutSignature(
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

    const attempt = await paymentRepository.getAttemptByProviderOrderId(
      providerOrderId
    );
    if (
      !attempt ||
      (options.userId !== undefined && attempt.userId !== options.userId)
    ) {
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
      await paymentRepository.updatePayment(
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
    const candidates = await paymentRepository
      .selectAttempts()
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
          const receipt = buildPaymentReceipt(candidate);
          const recoveredOrder = await gateway.findOrderByReceipt(receipt);
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
            recoveredOrder.receipt !== receipt
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
        const attempt = await paymentRepository.getAttemptByOrderId(orderId);
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
        if (!attempt.providerOrderId && attempt.status === "processing") {
          const message =
            "Processing payment has no attached provider order; reservation was preserved for payment recovery";
          logger.error(message, {
            orderId,
            localPaymentId: attempt.localPaymentId,
          });
          results.push({ orderId, status: "conflict", error: message });
          continue;
        }

        if (attempt.providerOrderId) {
          if (!config) {
            const message =
              "Razorpay configuration is unavailable; reservation was preserved";
            logger.error(message, {
              orderId,
              providerOrderId: attempt.providerOrderId,
            });
            results.push({ orderId, status: "error", error: message });
            continue;
          }

          const gateway = createRazorpayGateway(config);
          let providerOrder: RazorpayOrderSnapshot;
          let providerPayments: RazorpayPaymentSnapshot[];
          try {
            [providerOrder, providerPayments] = await Promise.all([
              gateway.fetchOrder(attempt.providerOrderId),
              gateway.fetchOrderPayments(attempt.providerOrderId),
            ]);
          } catch (error) {
            logger.warn(
              "Could not fetch Razorpay order status during reservation expiry",
              {
                orderId,
                providerOrderId: attempt.providerOrderId,
                error:
                  error instanceof Error ? error.message : "Provider error",
              }
            );
            const message =
              "Could not verify Razorpay state; reservation was preserved";
            results.push({ orderId, status: "error", error: message });
            continue;
          }

          const paidOrAuthorized = providerPayments.find(
            (payment) =>
              payment.status === "captured" || payment.status === "authorized"
          );
          if (paidOrAuthorized && providerOrder.status === "paid") {
            const result = await this.reconcileProviderPayment(
              attempt.providerOrderId,
              paidOrAuthorized.id,
              { requireCaptured: true }
            );
            if (
              result.finalizedNow ||
              ("paymentStatus" in result &&
                (result.paymentStatus === "completed" ||
                  result.paymentStatus === "refunded"))
            ) {
              results.push({ orderId, status: "finalized" });
              continue;
            }
          }
          if (paidOrAuthorized) {
            const message =
              "Razorpay payment state is not safe to expire; reservation was preserved";
            logger.error(message, {
              orderId,
              providerOrderId: attempt.providerOrderId,
              providerOrderStatus: providerOrder.status,
              providerPaymentId: paidOrAuthorized.id,
              providerPaymentStatus: paidOrAuthorized.status,
            });
            results.push({ orderId, status: "conflict", error: message });
            continue;
          }
          if (providerOrder.status === "paid") {
            const message =
              "Razorpay order is paid but no captured payment was returned; reservation was preserved";
            logger.error(message, {
              orderId,
              providerOrderId: attempt.providerOrderId,
            });
            results.push({ orderId, status: "conflict", error: message });
            continue;
          }
        }

        await db.transaction(async (tx) => {
          const [order] = await tx
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, orderId))
            .for("update")
            .limit(1);
          if (!order || order.status !== "awaiting_payment") return;

          const [payment] = await tx
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.id, attempt.localPaymentId))
            .for("update")
            .limit(1);
          if (
            payment &&
            (payment.status === "pending" || payment.status === "processing")
          ) {
            await paymentRepository.updatePayment(
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
      finalized: results.filter((result) => result.status === "finalized").length,
      released: results.filter((result) => result.status === "released").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      conflicts: results.filter((result) => result.status === "conflict").length,
      errors: results.filter((result) => result.status === "error").length,
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
    const attempt = await paymentRepository.getAttemptByProviderOrderId(
      providerOrderId
    );
    if (!attempt) return { ignored: true as const, finalizedNow: false };

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

  async markProviderPaymentFailed(
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

      await paymentRepository.updatePayment(
        {
          status: "failed",
          providerStatus: "failed",
          providerPaymentId: providerPayment.id,
          failureCode: sanitizeProviderText(failure.code, "PAYMENT_FAILED"),
          failureDescription: sanitizeProviderText(
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
      await paymentRepository.updatePayment(
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
      await paymentRepository.updatePayment(
        { providerStatus },
        payment.id,
        tx
      );
    });
  }
}

export { PaymentReconciliationService };
export default new PaymentReconciliationService();
