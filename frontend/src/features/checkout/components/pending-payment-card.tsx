import { useState } from "react";
import { Button } from "@mantine/core";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import axios from "axios";
import { error, success, warning, formatPaise } from "@/shared/lib";
import { checkoutErrorMessage } from "../model/checkout.helpers";
import {
  usePaymentMethods,
  useRunPaymentSimulator,
  useRetryRazorpayOrder,
  useVerifyRazorpayPayment,
} from "../api/payment.mutations";
import { openRazorpayCheckout } from "../lib/razorpay";

type PendingPaymentCardProps = {
  localOrderId: number;
  amountPaise: number;
  contact?: string;
};

export const PendingPaymentCard = ({
  localOrderId,
  amountPaise,
  contact,
}: PendingPaymentCardProps) => {
  const retryPayment = useRetryRazorpayOrder();
  const verifyPayment = useVerifyRazorpayPayment();
  const runSimulator = useRunPaymentSimulator();
  const { data: paymentMethods, isLoading: loadingMethods } = usePaymentMethods();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const busy = retryPayment.isPending || verifyPayment.isPending || runSimulator.isPending || !!statusMessage;
  const retryEnabled = paymentMethods?.razorpay ?? false;

  const retry = async () => {
    if (busy || !retryEnabled) return;
    setFailureMessage(null);
    try {
      setStatusMessage("Preparing secure payment…");
      const { data: checkout } = await retryPayment.mutateAsync(localOrderId);
      if (!checkout.checkoutReady) {
        throw new Error(
          checkout.failure?.description ??
            "This payment is still being prepared. Please try again shortly."
        );
      }

      setStatusMessage("Preparing online checkout…");
      if (checkout.providerMode === "simulator") {
        setStatusMessage("Running deterministic demo payment...");
        const simulated = await runSimulator.mutateAsync({ localOrderId });
        if (!simulated.data.reconciliation) {
          throw new Error("The simulator did not produce a payment result.");
        }
        success(simulated.message);
        return;
      }

      const result = await openRazorpayCheckout({
        checkout,
        prefill: { contact },
        onPaymentFailed: (message) => error(message, "Payment failed"),
      });
      if (result.kind === "dismissed") {
        warning(
          "The payment window was closed. This order remains available to retry.",
          "Payment not confirmed"
        );
        return;
      }

      setStatusMessage("Verifying captured payment…");
      const verification = await verifyPayment.mutateAsync({
        localOrderId,
        ...result.response,
      });
      success(verification.message);
    } catch (cause) {
      setFailureMessage(checkoutErrorMessage(cause, cause instanceof Error ? cause.message : "Payment could not be retried."));
      error(
        axios.isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data.message ?? "Payment could not be retried."
          : cause instanceof Error
            ? cause.message
            : "Payment could not be retried.",
        "Payment not confirmed"
      );
    } finally {
      setStatusMessage(null);
    }
  };

  return (
    <section className="mb-5 rounded-card border border-amber-200 bg-amber-50 p-5 shadow-subtle sm:p-6" aria-labelledby="pending-payment-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand">
            <CreditCard size={21} aria-hidden="true" />
          </span>
          <div>
            <h2 id="pending-payment-title" className="font-semibold text-ink">
              Payment required
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              {retryEnabled
                ? paymentMethods?.providerMode === "simulator"
                  ? "This order is safely saved. The local demo provider can complete it without credentials or network access."
                  : "This order is safely saved but will not reach the kitchen until Razorpay confirms a captured payment."
                : "Online checkout is temporarily paused. Your order remains saved and will not reach the kitchen until payment is captured."}
            </p>
            <p className="mt-2 text-sm">Saved total: {formatPaise(amountPaise)}. Retry uses this order’s captured prices and promotions.</p>
            {failureMessage && <p className="mt-2 text-sm text-danger" role="alert">{failureMessage}</p>}
            {statusMessage && (
              <p className="mt-2 text-sm font-semibold text-brand" role="status">
                {statusMessage}
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={retry}
          loading={busy || loadingMethods}
          disabled={!retryEnabled}
          leftSection={<RefreshCw size={16} />}
          rightSection={<ShieldCheck size={16} />}
          className="shrink-0"
        >
          {retryEnabled
            ? paymentMethods?.providerMode === "simulator"
              ? "Complete demo payment"
              : "Retry secure payment"
            : "Online payment paused"}
        </Button>
      </div>
    </section>
  );
};

export default PendingPaymentCard;
