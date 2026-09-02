import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, paymentAttemptsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import { orderGrandTotalRupees } from "../order/order.mapper";
import { sanitizeProviderText } from "./payment.helpers";
import paymentRepository from "./payment.repository";
import type {
  FinalizeCapturedPaymentInput,
  LocalRazorpayAttempt,
} from "./payment.types";
import type { RazorpayPaymentSnapshot } from "./razorpay.types";

export class PaymentFinalizationService {
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
          totalPrice: orderGrandTotalRupees(record.order),
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
      if (typeof tx?.update === "function") {
        await tx
          .update(paymentAttemptsTable)
          .set({
            status: "captured",
            providerStatus: data.providerStatus,
            providerPaymentId: data.providerPaymentId,
            capturedAt: paidAt,
            updatedAt: paidAt,
          })
          .where(
            and(
              eq(paymentAttemptsTable.orderId, record.order.id),
              eq(paymentAttemptsTable.provider, "razorpay")
            )
          );
      }
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
        totalPrice: orderGrandTotalRupees(record.order),
        paymentStatus: "completed" as const,
        orderStatus: "pending" as const,
        finalizedNow: true,
      };
    });
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
          totalPrice: orderGrandTotalRupees(record.order),
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
      if (typeof tx?.update === "function") {
        await tx
          .update(paymentAttemptsTable)
          .set({
            status: "failed",
            providerStatus: "failed",
            providerPaymentId: providerPayment.id,
            failureCode: sanitizeProviderText(failure.code, "PAYMENT_FAILED"),
            failureDescription: sanitizeProviderText(
              failure.description,
              "Razorpay reported a failed payment"
            ),
            failedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(paymentAttemptsTable.orderId, record.order.id),
              eq(paymentAttemptsTable.provider, "razorpay")
            )
          );
      }
      await checkoutService.releaseCouponReservation(record.order.id, tx);
      await inventoryService.releaseReservations(record.order.id, tx);

      return {
        localOrderId: record.order.id,
        localPaymentId: record.payment.id,
        totalPrice: orderGrandTotalRupees(record.order),
        paymentStatus: "failed" as const,
        orderStatus: record.order.status,
        finalizedNow: false,
      };
    });
  }
}

export default new PaymentFinalizationService();
