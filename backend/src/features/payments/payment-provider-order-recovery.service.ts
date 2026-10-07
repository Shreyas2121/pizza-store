import { AppError } from "../../utils/error";
import { paymentsTable } from "../../db/schema";
import paymentRepository from "./payment.repository";
import { getRazorpayConfig } from "./razorpay.config";
import { createRazorpayGateway } from "./razorpay.gateway";
import type {
  ProviderPaymentReconciliationResult,
  ReconcileProviderPayment,
} from "./payment-reconciliation.types";
import type { LocalRazorpayAttempt } from "./payment.types";

interface ProviderOrderRecoveryHooks {
  reconcileProviderPayment: ReconcileProviderPayment;
  recordProviderObservation: (
    attempt: LocalRazorpayAttempt,
    providerStatus: typeof paymentsTable.$inferInsert.providerStatus
  ) => Promise<void>;
}

export class PaymentProviderOrderRecoveryService {
  async reconcileProviderOrder(
    providerOrderId: string,
    hooks: ProviderOrderRecoveryHooks
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
    if (!attempt) return { ignored: true, finalizedNow: false };

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
        attempt.grandTotalPaise !== attempt.amountPaise ||
        providerOrder.amountPaise !== attempt.amountPaise ||
        providerOrder.currency !== attempt.currency
      ) {
        throw new AppError(
          "Provider order does not match the local payment",
          409,
          "PAYMENT_PROVIDER_MISMATCH"
        );
      }
      await hooks.recordProviderObservation(attempt, providerOrder.status);
      return {
        localOrderId: attempt.localOrderId,
        localPaymentId: attempt.localPaymentId,
        paymentStatus: attempt.status,
        orderStatus: attempt.orderStatus,
        finalizedNow: false,
      };
    }
    return await hooks.reconcileProviderPayment(
      providerOrderId,
      providerPayment.id
    );
  }
}

export default new PaymentProviderOrderRecoveryService();
