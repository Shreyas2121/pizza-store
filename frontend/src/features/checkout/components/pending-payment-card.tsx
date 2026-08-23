import { useState } from "react";
import { Button } from "@mantine/core";
import { CreditCard, RefreshCw, ShieldCheck } from "lucide-react";
import axios from "axios";
import { error, success, warning } from "@/shared/lib";
import {
  usePaymentMethods,
  useRetryRazorpayOrder,
  useVerifyRazorpayPayment,
} from "../api/payment.mutations";
import { openRazorpayCheckout } from "../lib/razorpay";

type PendingPaymentCardProps = {
  localOrderId: number;
  contact?: string;
};

export const PendingPaymentCard = ({
  localOrderId,
  contact,
}: PendingPaymentCardProps) => {
  const retryPayment = useRetryRazorpayOrder();
  const verifyPayment = useVerifyRazorpayPayment();
  const { data: paymentMethods, isLoading: loadingMethods } = usePaymentMethods();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const busy = retryPayment.isPending || verifyPayment.isPending || !!statusMessage;
  const retryEnabled = paymentMethods?.razorpay ?? false;

  const retry = async () => {
    try {
      setStatusMessage("Preparing secure payment…");
      const { data: checkout } = await retryPayment.mutateAsync(localOrderId);
      if (!checkout.checkoutReady) {
        throw new Error(
          checkout.failure?.description ??
            "This payment is still being prepared. Please try again shortly."
        );
      }

      setStatusMessage("Opening Razorpay Checkout…");
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
                ? "This order is safely saved but will not reach the kitchen until Razorpay confirms a captured payment."
                : "Online checkout is temporarily paused. Your order remains saved and will not reach the kitchen until payment is captured."}
            </p>
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
          {retryEnabled ? "Retry secure payment" : "Online payment paused"}
        </Button>
      </div>
    </section>
  );
};

export default PendingPaymentCard;
