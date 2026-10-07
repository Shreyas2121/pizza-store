import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, paymentAttemptsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import { promotionApplicationService } from "../promotions/applications";
import inventoryService from "../inventory/inventory.service";
import { orderGrandTotalRupees } from "../order/order.mapper";
import { sanitizeProviderText } from "./payment.helpers";
import paymentRepository from "./payment.repository";
import type {
  FinalizeCapturedPaymentInput,
  LocalRazorpayAttempt,
} from "./payment.types";
import type { RazorpayPaymentSnapshot } from "./razorpay.types";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";
import { businessDateFor } from "../../utils/business-date";

export class PaymentFinalizationService {
  constructor(private readonly eventWriter: FinancialEventWriter = financialEventService) {}

  async finalizeCapturedPayment(data: FinalizeCapturedPaymentInput) {
    return await db.transaction(async (tx) => {
      await paymentRepository.lockLifecycleOwner(data.localOrderId, tx);
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
        record.order.grandTotalPaise !== data.amountPaise ||
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

      await inventoryService.restoreReservationsForOrder(record.order.id, tx);
      await inventoryService.consumeReservationsForOrder(record.order.id, tx);
      // Only authoritative capture may restore already-paid capacity without limits.
      await promotionApplicationService.restore(record.order.id, tx, new Date(), false);
      await promotionApplicationService.consume(record.order.id, tx);

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
      {
        const capturedAttempt = (await tx
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
              eq(paymentAttemptsTable.provider, "razorpay"),
              eq(paymentAttemptsTable.providerOrderId, data.providerOrderId)
            )
          )
          .returning())[0];
        if (!capturedAttempt) {
          throw new AppError("Payment attempt not found", 409, "PAYMENT_ATTEMPT_NOT_FOUND");
        }
        await this.eventWriter.write(tx, {
          eventType: "payment_attempt.captured",
          schemaVersion: 1,
          sourceType: "payment_attempt",
          sourceId: capturedAttempt.id,
          sourceVersion: 1,
          storeId: record.order.storeId,
          currency: record.payment.currency,
          occurredAt: paidAt,
          businessDate: businessDateFor(paidAt, record.order.pricingTimezone),
          timezone: record.order.pricingTimezone,
          payload: {
            paymentAttemptId: capturedAttempt.id,
            orderId: record.order.id,
            provider: "razorpay",
            method: capturedAttempt.method ?? "other",
            capturedPaise: record.payment.amountPaise,
            capturedAt: paidAt.toISOString(),
            providerReference: data.providerPaymentId,
          },
        });
      }
      await tx
        .update(ordersTable)
        .set({ status: "pending" })
        .where(eq(ordersTable.id, record.order.id));


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
      await paymentRepository.lockLifecycleOwner(attempt.localOrderId, tx);
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
      {
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
      await inventoryService.releaseReservations(record.order.id, tx);
      await promotionApplicationService.release(record.order.id, tx);

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
