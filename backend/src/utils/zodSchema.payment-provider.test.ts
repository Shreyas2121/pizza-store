import { describe, expect, it } from "vitest";
import { envSchema } from "./zodSchema";

const base = {
  PORT: "3000",
  JWT_SECRET: "test-secret",
  FE_URL: "http://localhost:5173",
};

describe("payment provider environment", () => {
  it("selects the deterministic simulator by default", () => {
    expect(envSchema.parse(base).PAYMENT_PROVIDER_MODE).toBe("simulator");
  });

  it("requires all credentials for optional Razorpay test mode", () => {
    const result = envSchema.safeParse({
      ...base,
      PAYMENT_PROVIDER_MODE: "razorpay_test",
    });
    expect(result.success).toBe(false);
  });

  it("refuses explicit live mode and live credentials", () => {
    const liveMode = envSchema.safeParse({
      ...base,
      PAYMENT_PROVIDER_MODE: "razorpay_live",
      RAZORPAY_KEY_ID: "rzp_live_example",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook",
    });
    expect(liveMode.success).toBe(false);

    const liveKey = envSchema.safeParse({
      ...base,
      PAYMENT_PROVIDER_MODE: "razorpay_test",
      RAZORPAY_KEY_ID: "rzp_live_example",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook",
    });
    expect(liveKey.success).toBe(false);
  });
});

describe("operational metrics environment", () => {
  it("requires a dedicated metrics token in production", () => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: "production" }).success).toBe(false);
    expect(envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      METRICS_BEARER_TOKEN: "metrics-only-secret-that-is-at-least-32-characters",
    }).success).toBe(true);
  });

  it("rejects short metrics tokens", () => {
    expect(envSchema.safeParse({ ...base, METRICS_BEARER_TOKEN: "too-short" }).success).toBe(false);
  });
});
