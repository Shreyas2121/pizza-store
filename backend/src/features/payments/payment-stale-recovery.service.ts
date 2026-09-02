import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, paymentAttemptsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import { buildPaymentReceipt } from "./payment.helpers";
import paymentRepository from "./payment.repository";
import { getRazorpayConfig } from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type {
  ProviderPaymentReconciliationResult,
  ReconcileProviderPayment,
} from "./payment-reconciliation.types";
import type { LocalRazorpayAttempt } from "./payment.types";
import type { RazorpayOrderSnapshot } from "./razorpay.types";

interface StaleRecoveryHooks {
  reconcileProviderPayment: ReconcileProviderPayment;
  reconcileProviderOrder: (
    providerOrderId: string
  ) => Promise<ProviderPaymentReconciliationResult>;
  attachRecoveredProviderOrder: (
    attempt: LocalRazorpayAttempt,
    providerOrder: RazorpayOrderSnapshot
  ) => Promise<void>;
}

export class PaymentStaleRecoveryService {
  async reconcileStalePayments(
    olderThanMinutes: number,
    limit: number,
    hooks: Pick<
      StaleRecoveryHooks,
      "reconcileProviderOrder" | "attachRecoveredProviderOrder"
    >
  ) {
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
          await hooks.attachRecoveredProviderOrder(candidate, recoveredOrder);
          logger.warn("Recovered an unattached Razorpay order by receipt", {
            localOrderId: candidate.localOrderId,
            localPaymentId: candidate.localPaymentId,
            providerOrderId,
          });
        }

        const result = await hooks.reconcileProviderOrder(providerOrderId);
        results.push({
          providerOrderId,
          status: result.finalizedNow
            ? "finalized"
            : "paymentStatus" in result && result.paymentStatus === "failed"
              ? "failed"
              : "unchanged",
          ...("localOrderId" in result
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

  async reconcileExpiredReservations(
    limit: number,
    hooks: Pick<StaleRecoveryHooks, "reconcileProviderPayment">
  ) {
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
          let providerOrder;
          let providerPayments;
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
            const result = await hooks.reconcileProviderPayment(
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
              .update(paymentAttemptsTable)
              .set({
                status: "expired",
                failureCode: "RESERVATION_EXPIRED",
                failureDescription:
                  "Payment reservation expired before completion",
                failedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(paymentAttemptsTable.orderId, orderId),
                  eq(paymentAttemptsTable.provider, "razorpay")
                )
              );
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

  async attachRecoveredProviderOrder(
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
      await tx
        .update(paymentAttemptsTable)
        .set({
          providerOrderId: providerOrder.id,
          providerStatus: providerOrder.status,
          status: "processing",
          failureCode: null,
          failureDescription: null,
          failedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentAttemptsTable.orderId, attempt.localOrderId),
            eq(paymentAttemptsTable.provider, "razorpay")
          )
        );
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
}

export default new PaymentStaleRecoveryService();
