import { env } from "../../utils/zodSchema";
import type { RazorpayServerConfig } from "./razorpay.types";

export const getRazorpayConfig = (): RazorpayServerConfig | null => {
  if (env.PAYMENT_PROVIDER_MODE === "simulator") {
    return {
      mode: "simulator",
      keyId: "simulator",
      keySecret: "simulator-checkout-secret",
      webhookSecret: "simulator-webhook-secret",
    };
  }
  if (
    !env.RAZORPAY_KEY_ID ||
    !env.RAZORPAY_KEY_SECRET ||
    !env.RAZORPAY_WEBHOOK_SECRET
  ) {
    return null;
  }

  return {
    mode: "razorpay_test",
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  };
};

// In test mode, disabling Checkout only stops new customer attempts.
// Credentials remain available so in-flight attempts can still reconcile.
export const isRazorpayCheckoutEnabled = () =>
  (env.PAYMENT_PROVIDER_MODE === "simulator" || env.RAZORPAY_ENABLED) &&
  getRazorpayConfig() !== null;

export const getPaymentProviderMode = () => env.PAYMENT_PROVIDER_MODE;

export const requireRazorpayConfig = (): RazorpayServerConfig => {
  const config = getRazorpayConfig();
  if (!config) {
    throw new Error("Razorpay is not configured on this server");
  }
  return config;
};
