import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../utils/error";
import { paymentWebhookRoutes } from "./payment.webhook.routes";
import webhookService from "./razorpay.webhook";

vi.mock("../../utils/request-failure-audit", () => ({ auditRequestFailure: vi.fn().mockResolvedValue(undefined) }));

describe("Razorpay webhook HTTP boundary", () => {
  let server: Server | undefined;
  beforeEach(() => { vi.spyOn(webhookService, "handle").mockResolvedValue({ eventId: "evt_1", eventType: "payment.captured", duplicate: false, inProgress: false, reconciliation: null }); });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) await new Promise<void>((resolve, reject) => server!.close((cause) => cause ? reject(cause) : resolve()));
    server = undefined;
  });
  const start = async (parsedFirst = false) => {
    const app = express();
    if (parsedFirst) app.use(express.json());
    app.use("/api/v1/payments/razorpay/webhook", paymentWebhookRoutes);
    app.use(express.json());
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    return `http://127.0.0.1:${address.port}/api/v1/payments/razorpay/webhook`;
  };
  const request = (url: string, body: string, headers: Record<string, string> = {}) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Razorpay-Signature": "test-signature", "X-Razorpay-Event-Id": "evt_1", ...headers }, body });

  it("passes exact raw bytes and provider headers without requiring a browser login", async () => {
    const body = '{\n  "event": "payment.captured", "payload": {}\n}\n';
    const response = await request(await start(), body);
    expect(response.status).toBe(200);
    expect(webhookService.handle).toHaveBeenCalledWith(Buffer.from(body), "test-signature", "evt_1");
    expect(await response.json()).toMatchObject({ message: "Webhook accepted" });
  });
  it("rejects missing signatures and missing or oversized event IDs before processing", async () => {
    const url = await start();
    const cases: Record<string, string>[] = [{ "X-Razorpay-Signature": "" }, { "X-Razorpay-Event-Id": "" }, { "X-Razorpay-Event-Id": "x".repeat(256) }];
    for (const headers of cases) {
      expect((await request(url, "{}", headers)).status).toBe(400);
    }
    expect(webhookService.handle).not.toHaveBeenCalled();
  });
  it("rejects bodies parsed before the raw route", async () => {
    expect((await request(await start(true), "{}")).status).toBe(400);
    expect(webhookService.handle).not.toHaveBeenCalled();
  });
  it("preserves signature failures and retryable in-progress responses", async () => {
    const url = await start();
    for (const [status, code] of [[400, "WEBHOOK_SIGNATURE_INVALID"], [503, "WEBHOOK_IN_PROGRESS"]] as const) {
      vi.mocked(webhookService.handle).mockRejectedValueOnce(new AppError("Test rejection", status, code));
      const response = await request(url, "{}");
      expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ code });
    }
  });
  it("acknowledges duplicate deliveries", async () => {
    const url = await start();
    vi.mocked(webhookService.handle).mockResolvedValueOnce({ eventId: "evt_1", eventType: "payment.captured", duplicate: true, inProgress: false, reconciliation: null });
    const response = await request(url, "{}");
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ data: { duplicate: true } });
  });
});
