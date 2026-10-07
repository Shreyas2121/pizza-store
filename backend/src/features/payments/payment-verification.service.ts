import { AppError } from "../../utils/error";
import { logger } from "../../utils/logger";
import { isValidCheckoutSignature } from "./payment.helpers";
import paymentRepository from "./payment.repository";
import { getRazorpayConfig } from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type {
  ProviderPaymentReconciliationResult,
  ReconcileProviderPayment,
  ReconcileProviderPaymentOptions,
} from "./payment-reconciliation.types";
import type {
  FinalizeCapturedPaymentInput,
  LocalRazorpayAttempt,
  VerifyRazorpayPaymentInput,
} from "./payment.types";
import type {
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
} from "./razorpay.types";

interface PaymentVerificationHooks {
  reconcileProviderPayment: ReconcileProviderPayment;
  finalizeCapturedPayment: (
    data: FinalizeCapturedPaymentInput
  ) => Promise<ProviderPaymentReconciliationResult>;
  markProviderPaymentFailed: (
    attempt: LocalRazorpayAttempt,
    providerPayment: RazorpayPaymentSnapshot,
    failure: { code?: string | null; description?: string | null }
  ) => Promise<ProviderPaymentReconciliationResult>;
  recordProviderObservation: (
    attempt: LocalRazorpayAttempt,
    providerStatus: RazorpayPaymentSnapshot["status"]
  ) => Promise<void>;
}

export class PaymentVerificationService {
  async verifyRazorpayPayment(
    data: VerifyRazorpayPaymentInput,
    hooks: Pick<PaymentVerificationHooks, "reconcileProviderPayment">
  ) {
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

    const result = await hooks.reconcileProviderPayment(
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
    options: ReconcileProviderPaymentOptions,
    hooks: Omit<PaymentVerificationHooks, "reconcileProviderPayment">
  ): Promise<ProviderPaymentReconciliationResult> {
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
      return { ignored: true, finalizedNow: false };
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
      return await hooks.finalizeCapturedPayment({
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
      return await hooks.markProviderPaymentFailed(attempt, providerPayment, {
        code: options.failureCode,
        description: options.failureDescription,
      });
    }

    await hooks.recordProviderObservation(attempt, providerPayment.status);
    return {
      localOrderId: attempt.localOrderId,
      localPaymentId: attempt.localPaymentId,
      paymentStatus: attempt.status,
      orderStatus: attempt.orderStatus,
      finalizedNow: false,
    };
  }

  private assertProviderStateMatches(
    attempt: LocalRazorpayAttempt,
    providerPayment: RazorpayPaymentSnapshot,
    providerOrder: RazorpayOrderSnapshot
  ) {
    if (
      attempt.grandTotalPaise !== attempt.amountPaise ||
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
}

export default new PaymentVerificationService();
