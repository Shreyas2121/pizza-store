import { env } from "../../utils/zodSchema";
import type { RazorpayServerConfig } from "./razorpay.types";

export const getRazorpayConfig = (): RazorpayServerConfig | null => {
  if (
    !env.RAZORPAY_KEY_ID ||
    !env.RAZORPAY_KEY_SECRET ||
    !env.RAZORPAY_WEBHOOK_SECRET
  ) {
    return null;
  }

  return {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  };
};

// Disabling Checkout only stops new customer attempts. Credentials remain
// available so verification, webhooks, and reconciliation can finish payments
// that were already in flight before a rollback.
export const isRazorpayCheckoutEnabled = () =>
  env.RAZORPAY_ENABLED && getRazorpayConfig() !== null;

export const requireRazorpayConfig = (): RazorpayServerConfig => {
  const config = getRazorpayConfig();
  if (!config) {
    throw new Error("Razorpay is not configured on this server");
  }
  return config;
};
