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

export const requireRazorpayConfig = (): RazorpayServerConfig => {
  const config = getRazorpayConfig();
  if (!config) {
    throw new Error("Razorpay is not configured on this server");
  }
  return config;
};
