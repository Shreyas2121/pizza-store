import { paymentsTable } from "../../db/schema";
import paymentFinalizationService from "./payment-finalization.service";
import paymentObservationService from "./payment-observation.service";
import paymentProviderOrderRecoveryService from "./payment-provider-order-recovery.service";
import paymentStaleRecoveryService from "./payment-stale-recovery.service";
import type {
  ProviderPaymentReconciliationResult,
  ReconcileProviderPaymentOptions,
} from "./payment-reconciliation.types";
import paymentVerificationService from "./payment-verification.service";
import type {
  FinalizeCapturedPaymentInput,
  LocalRazorpayAttempt,
  VerifyRazorpayPaymentInput,
} from "./payment.types";
import type {
  RazorpayOrderSnapshot,
  RazorpayPaymentSnapshot,
} from "./razorpay.types";

/**
 * Public reconciliation facade. Routes and callers retain the original API,
 * while focused collaborators own verification, finalization, recovery, and
 * provider-observation behavior.
 */
class PaymentReconciliationService {
  async verifyRazorpayPayment(data: VerifyRazorpayPaymentInput) {
    return await paymentVerificationService.verifyRazorpayPayment(data, {
      reconcileProviderPayment: (...args) =>
        this.reconcileProviderPayment(...args),
    });
  }

  async reconcileProviderPayment(
    providerOrderId: string,
    providerPaymentId: string,
    options: ReconcileProviderPaymentOptions = {}
  ): Promise<ProviderPaymentReconciliationResult> {
    return await paymentVerificationService.reconcileProviderPayment(
      providerOrderId,
      providerPaymentId,
      options,
      {
        finalizeCapturedPayment: (data) => this.finalizeCapturedPayment(data),
        markProviderPaymentFailed: (attempt, providerPayment, failure) =>
          this.markProviderPaymentFailed(attempt, providerPayment, failure),
        recordProviderObservation: (attempt, providerStatus) =>
          this.recordProviderObservation(attempt, providerStatus),
      }
    );
  }

  async finalizeCapturedPayment(
    data: FinalizeCapturedPaymentInput
  ): Promise<ProviderPaymentReconciliationResult> {
    return await paymentFinalizationService.finalizeCapturedPayment(data);
  }

  async reconcileStalePayments(olderThanMinutes: number, limit: number) {
    return await paymentStaleRecoveryService.reconcileStalePayments(
      olderThanMinutes,
      limit,
      {
        reconcileProviderOrder: (providerOrderId) =>
          this.reconcileProviderOrder(providerOrderId),
        attachRecoveredProviderOrder: (attempt, providerOrder) =>
          this.attachRecoveredProviderOrder(attempt, providerOrder),
      }
    );
  }

  async reconcileExpiredReservations(limit = 25) {
    return await paymentStaleRecoveryService.reconcileExpiredReservations(
      limit,
      {
        reconcileProviderPayment: (...args) =>
          this.reconcileProviderPayment(...args),
      }
    );
  }

  async reconcileProviderOrder(
    providerOrderId: string
  ): Promise<ProviderPaymentReconciliationResult> {
    return await paymentProviderOrderRecoveryService.reconcileProviderOrder(
      providerOrderId,
      {
        reconcileProviderPayment: (...args) =>
          this.reconcileProviderPayment(...args),
        recordProviderObservation: (attempt, providerStatus) =>
          this.recordProviderObservation(attempt, providerStatus),
      }
    );
  }

  async markProviderPaymentFailed(
    attempt: LocalRazorpayAttempt,
    providerPayment: RazorpayPaymentSnapshot,
    failure: { code?: string | null; description?: string | null }
  ): Promise<ProviderPaymentReconciliationResult> {
    return await paymentFinalizationService.markProviderPaymentFailed(
      attempt,
      providerPayment,
      failure
    );
  }

  private async attachRecoveredProviderOrder(
    attempt: LocalRazorpayAttempt,
    providerOrder: RazorpayOrderSnapshot
  ) {
    await paymentStaleRecoveryService.attachRecoveredProviderOrder(
      attempt,
      providerOrder
    );
  }

  private async recordProviderObservation(
    attempt: LocalRazorpayAttempt,
    providerStatus: typeof paymentsTable.$inferInsert.providerStatus
  ) {
    await paymentObservationService.recordProviderObservation(
      attempt,
      providerStatus
    );
  }
}

export { PaymentReconciliationService };
export default new PaymentReconciliationService();
