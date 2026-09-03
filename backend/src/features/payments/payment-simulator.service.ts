import { AppError } from "../../utils/error";
import { buildPaymentReceipt } from "./payment.helpers";
import { paymentProviderSimulator } from "./payment-provider-simulator";
import type { SimulatorScenario } from "./payment-provider-simulator";
import paymentRepository from "./payment.repository";
import paymentService from "./payment.service";
import { getRazorpayConfig } from "./razorpay.config";

class PaymentSimulatorService {
  async advance(
    localOrderId: number,
    userId: number,
    scenario?: SimulatorScenario
  ) {
    if (getRazorpayConfig()?.mode !== "simulator") {
      throw new AppError("Payment simulator is not enabled", 404);
    }
    const attempt = await paymentRepository.getAttemptByOrderId(localOrderId);
    if (
      !attempt ||
      attempt.userId !== userId ||
      attempt.provider !== "razorpay" ||
      !attempt.providerOrderId
    ) {
      throw new AppError("Payment order not found", 404);
    }

    const simulatorOrder = await paymentProviderSimulator.createOrder({
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      receipt: buildPaymentReceipt(attempt),
    });
    if (simulatorOrder.id !== attempt.providerOrderId) {
      throw new AppError(
        "Simulator order does not match the local payment",
        409,
        "PAYMENT_PROVIDER_MISMATCH"
      );
    }
    const simulatorPayment = await paymentProviderSimulator.fetchOrderPayments(
      attempt.providerOrderId
    );
    if (attempt.status === "processing" && simulatorPayment[0]?.status === "failed") {
      paymentProviderSimulator.restart(attempt.providerOrderId);
    }
    if (scenario) paymentProviderSimulator.script(attempt.providerOrderId, scenario);

    const event = paymentProviderSimulator.advance(attempt.providerOrderId);
    if (!event) {
      return {
        event: null,
        scenario: paymentProviderSimulator.getScenario(attempt.providerOrderId),
        reconciliation: null,
      };
    }
    const reconciliation = await paymentService.reconcileProviderPayment(
      event.providerOrderId,
      event.providerPaymentId,
      event.eventType === "payment.failed"
        ? {
            userId,
            failureCode: "SIMULATED_PAYMENT_FAILED",
            failureDescription: "The deterministic simulator declined this payment",
          }
        : { userId }
    );
    return {
      event,
      scenario: paymentProviderSimulator.getScenario(attempt.providerOrderId),
      reconciliation,
    };
  }
}

export default new PaymentSimulatorService();
