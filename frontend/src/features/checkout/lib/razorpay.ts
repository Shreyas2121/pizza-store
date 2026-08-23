import type { RazorpayCheckoutData } from "../model/checkout.types";

const RAZORPAY_SCRIPT_ID = "razorpay-checkout-script";
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
  handler: (response: RazorpaySuccessResponse) => void;
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: RazorpayFailureResponse) => void
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loaderPromise: Promise<void> | null = null;

export const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      RAZORPAY_SCRIPT_ID
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const onLoad = () => {
      if (!window.Razorpay) {
        loaderPromise = null;
        reject(new Error("Razorpay Checkout did not initialize"));
        return;
      }
      resolve();
    };
    const onError = () => {
      loaderPromise = null;
      script.remove();
      reject(new Error("Could not load Razorpay Checkout"));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = RAZORPAY_SCRIPT_ID;
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return loaderPromise;
};

export const openRazorpayCheckout = async ({
  checkout,
  prefill,
  onPaymentFailed,
}: {
  checkout: RazorpayCheckoutData;
  prefill?: { name?: string; email?: string; contact?: string };
  onPaymentFailed?: (message: string) => void;
}) => {
  if (!checkout.keyId || !checkout.razorpayOrderId || !checkout.checkoutReady) {
    throw new Error("This payment is not ready for Razorpay Checkout");
  }

  await loadRazorpayCheckout();
  if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable");

  return await new Promise<
    | { kind: "success"; response: RazorpaySuccessResponse }
    | { kind: "dismissed" }
  >((resolve) => {
    let settled = false;
    const finish = (
      result:
        | { kind: "success"; response: RazorpaySuccessResponse }
        | { kind: "dismissed" }
    ) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const instance = new window.Razorpay!({
      key: checkout.keyId!,
      amount: checkout.amountPaise,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      order_id: checkout.razorpayOrderId!,
      prefill,
      theme: { color: "#C83E2B" },
      modal: {
        confirm_close: true,
        ondismiss: () => finish({ kind: "dismissed" }),
      },
      handler: (response) => finish({ kind: "success", response }),
    });
    instance.on("payment.failed", (response) => {
      onPaymentFailed?.(
        response.error.description ??
          "The payment attempt failed. You can retry securely."
      );
    });
    instance.open();
  });
};
