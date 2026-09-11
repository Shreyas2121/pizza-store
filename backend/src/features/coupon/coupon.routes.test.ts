import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import authenticationService from "../auth/auth.service";
import checkoutService from "../checkout/checkout.service";
import { couponRoutes } from "./coupon.routes";

const servers: Server[] = [];

const request = async (path: string, init?: RequestInit) => {
  const app = express();
  app.use(express.json());
  app.use("/coupon", couponRoutes);

  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port");
  }

  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
};

describe("legacy coupon routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
    );
  });

  it.each([
    ["POST", "/coupon"],
    ["GET", "/coupon"],
    ["GET", "/coupon/1"],
    ["GET", "/coupon/code/SAVE10"],
    ["PUT", "/coupon/1"],
    ["DELETE", "/coupon/1"],
  ])("does not expose %s %s", async (method, path) => {
    const response = await request(path, { method });

    expect(response.status).toBe(404);
  });

  it("keeps authenticated coupon validation available during cutover", async () => {
    vi.spyOn(authenticationService, "authenticateToken").mockResolvedValue({
      userId: 7,
      email: "customer@example.com",
      platformRole: "user",
      tokenVersion: 1,
    });
    vi.spyOn(checkoutService, "previewCoupon").mockResolvedValue({
      couponRecord: {
        id: 3,
        code: "SAVE10",
        discountType: "fixed",
        discountRateBps: null,
        discountAmountPaise: 1_000,
        minimumOrderPaise: 0,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-10-01T00:00:00.000Z"),
        isActive: true,
        redemptionCount: 0,
        maxRedemptions: -1,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      quote: {
        quoteVersion: "2026-09-01-02",
        currency: "INR",
        pricingPolicyVersion: 3,
        itemsSubtotalPaise: 10_000,
        discountPaise: 1_000,
        deliveryFeePaise: 0,
        roundingAdjustmentPaise: 0,
        grandTotalPaise: 9_000,
        taxableAmountPaise: 8_571,
        taxPaise: 429,
        items: [],
        coupon: {
          id: 3,
          code: "SAVE10",
          discountPaise: 1_000,
          applied: true,
        },
        deliveryPricing: {
          ruleId: 1,
          ruleVersion: 1,
          storeId: 1,
          businessDate: "2026-09-11",
          timezone: "Asia/Kolkata",
          standardFeePaise: 0,
          freeDeliveryThresholdPaise: null,
          freeDeliveryApplied: false,
        },
        tax: {
          calculationPolicyVersion: 1,
          isDemo: true,
          disclaimer: "Portfolio demo — not a statutory tax invoice",
          placeOfSupplyState: "Karnataka",
          placeOfSupplySource: "delivery_address",
          itemRule: {
            ruleId: 1,
            ruleVersion: 1,
            rateBps: 500,
            hsnSacCode: "21069099-DEMO",
          },
          deliveryRule: {
            ruleId: 2,
            ruleVersion: 1,
            rateBps: 1800,
            hsnSacCode: "996813-DEMO",
            taxableAmountPaise: 0,
            taxPaise: 0,
          },
        },
      },
    });

    const response = await request("/coupon/validate", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: "save10" }),
    });

    expect(response.status).toBe(200);
    expect(checkoutService.previewCoupon).toHaveBeenCalledWith(7, "SAVE10");
    await expect(response.json()).resolves.toMatchObject({
      data: {
        id: 3,
        code: "SAVE10",
        discountPaise: 1_000,
        grandTotalPaise: 9_000,
      },
    });
  });
});
