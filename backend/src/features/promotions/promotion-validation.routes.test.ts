import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import authService from "../auth/auth.service";
import { checkoutService } from "../checkout";
import { AppError } from "../../utils/error";
import { createPromotionRoutes } from "./promotion.routes";
import { COUPON_VALIDATION_MAX_ATTEMPTS } from "./promotion-validation-limit";

describe("owned-cart promotion validation HTTP boundary", () => {
  let server: Server | undefined;
  afterEach(async () => {
    vi.restoreAllMocks();
    if (server)
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
    server = undefined;
  });
  const start = async (userId = 900) => {
    vi.spyOn(authService, "authenticateToken").mockResolvedValue({
      userId,
      email: "customer@example.test",
      platformRole: "customer",
      tokenVersion: 0,
    });
    const preview = vi
      .spyOn(checkoutService, "previewPromotionCoupon")
      .mockRejectedValue(
        new AppError("Test eligibility failure", 409, "PROMOTION_INELIGIBLE"),
      );
    const app = express();
    app.use(express.json());
    app.use("/promotions", createPromotionRoutes().promotions);
    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing port");
    return {
      preview,
      url: `http://127.0.0.1:${address.port}/promotions/validate`,
    };
  };
  const request = (url: string, body: unknown, authenticated = true) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authenticated ? { Authorization: "Bearer token" } : {}),
      },
      body: JSON.stringify(body),
    });
  it("requires authentication before resolving a cart or revealing coupon state", async () => {
    const h = await start();
    const response = await request(h.url, { couponCode: "SAVE" }, false);
    expect(response.status).toBe(401);
    expect(h.preview).not.toHaveBeenCalled();
  });
  it("accepts customer principals, normalizes the code, and preserves stable eligibility errors", async () => {
    const h = await start();
    const response = await request(h.url, { couponCode: " save " });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "PROMOTION_INELIGIBLE",
    });
    expect(h.preview).toHaveBeenCalledWith(900, "SAVE");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects store/prices/offer overrides and unknown fields without resolving the cart", async () => {
    const h = await start(901);
    for (const body of [
      { couponCode: "SAVE", storeId: 2 },
      { couponCode: "SAVE", items: [] },
      { couponCode: "SAVE", offerId: 1 },
      { couponCode: "" },
    ])
      expect((await request(h.url, body)).status).toBe(400);
    expect(h.preview).not.toHaveBeenCalled();
  });
  it("limits attempts before coupon resolution and returns Retry-After", async () => {
    const h = await start(902);
    for (let i = 0; i < COUPON_VALIDATION_MAX_ATTEMPTS; i++)
      expect((await request(h.url, { couponCode: "SAVE" })).status).toBe(409);
    const response = await request(h.url, { couponCode: "NEXT" });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    await expect(response.json()).resolves.toMatchObject({
      code: "PROMOTION_VALIDATION_RATE_LIMITED",
    });
    expect(h.preview).toHaveBeenCalledTimes(COUPON_VALIDATION_MAX_ATTEMPTS);
  });
});
