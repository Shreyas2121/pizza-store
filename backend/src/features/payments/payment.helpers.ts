import { createHmac, timingSafeEqual } from "crypto";
import type { LocalRazorpayAttempt } from "./payment.types";

export const sanitizeProviderText = (
  value: string | null | undefined,
  fallback: string
) => {
  const normalized = value?.replace(/[\r\n\t]+/g, " ").trim();
  return (normalized || fallback).slice(0, 500);
};

export const buildPaymentReceipt = (attempt: LocalRazorpayAttempt) =>
  `order_${attempt.localOrderId}_payment_${attempt.localPaymentId}`;

export const isValidCheckoutSignature = (
  providerOrderId: string,
  providerPaymentId: string,
  submittedSignature: string,
  keySecret: string
) => {
  const expectedSignature = createHmac("sha256", keySecret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest();
  const receivedSignature = Buffer.from(submittedSignature, "hex");

  return (
    receivedSignature.length === expectedSignature.length &&
    timingSafeEqual(receivedSignature, expectedSignature)
  );
};

export const toCheckoutResponse = (
  attempt: LocalRazorpayAttempt,
  keyId: string | null
) => ({
  localOrderId: attempt.localOrderId,
  localPaymentId: attempt.localPaymentId,
  keyId,
  razorpayOrderId: attempt.providerOrderId,
  amountPaise: attempt.amountPaise,
  currency: attempt.currency,
  name: "PizzaStore",
  description: `Order from ${attempt.storeName}`,
  paymentStatus: attempt.status,
  providerStatus: attempt.providerStatus,
  checkoutReady: Boolean(
    keyId && attempt.providerOrderId && attempt.status === "processing"
  ),
  failure:
    attempt.status === "failed"
      ? {
          code: attempt.failureCode,
          description: attempt.failureDescription,
        }
      : null,
});
