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
      JWT_SECRET: "production-signing-secret-of-at-least-32-characters",
      DATABASE_URL: "postgresql://user:password@db.example.test/pizzastore?sslmode=require",
      METRICS_BEARER_TOKEN: "metrics-only-secret-that-is-at-least-32-characters",
    }).success).toBe(true);
  });

  it("rejects short metrics tokens", () => {
    expect(envSchema.safeParse({ ...base, METRICS_BEARER_TOKEN: "too-short" }).success).toBe(false);
  });
});

describe("deployment environment", () => {
  it("requires complete Cloudinary credentials when remote storage is selected", () => {
    expect(envSchema.safeParse({ ...base, IMAGE_STORAGE: "cloudinary" }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, IMAGE_STORAGE: "cloudinary", CLOUDINARY_CLOUD_NAME: "demo", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" }).success).toBe(true);
  });
  it("accepts Render's default port and rejects invalid TCP ports", () => {
    expect(envSchema.parse({ ...base, PORT: "10000" }).PORT).toBe("10000");
    for (const PORT of ["0", "65536", "abcd", "3000x", "-1"]) {
      expect(envSchema.safeParse({ ...base, PORT }).success).toBe(false);
    }
  });

  it("rejects a production deployment without a database or strong signing secret", () => {
    const production = { ...base, NODE_ENV: "production", METRICS_BEARER_TOKEN: "m".repeat(32) };
    expect(envSchema.safeParse(production).success).toBe(false);
    expect(envSchema.safeParse({ ...production, JWT_SECRET: "s".repeat(32) }).success).toBe(false);
    expect(envSchema.safeParse({ ...production, DATABASE_URL: "postgresql://db.example.test/app" }).success).toBe(false);
  });
});
