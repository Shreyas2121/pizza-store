import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { financeMetricsRoutes } from "./finance-metrics.routes";
import repository from "./finance-metrics.repository";
import { logger } from "../../utils/logger";

vi.mock("../../utils/zodSchema", () => ({ env: { METRICS_BEARER_TOKEN: "m".repeat(32) } }));

describe("Prometheus metrics HTTP boundary", () => {
  let server: Server | undefined;
  beforeEach(() => {
    vi.spyOn(repository, "snapshot").mockResolvedValue({ outbox: [], refunds: [], unsettled: [], settlements: [], openCashSessions: 0, cashVariancePaise: 0 });
    vi.spyOn(logger, "error").mockImplementation(() => logger);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) await new Promise<void>((resolve, reject) => server!.close((cause) => cause ? reject(cause) : resolve()));
    server = undefined;
  });
  const start = async () => {
    const app = express(); app.use(financeMetricsRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    return `http://127.0.0.1:${address.port}/metrics`;
  };
  const headers = { Authorization: `Bearer ${"m".repeat(32)}` };
  it("requires the monitoring token before collecting financial data", async () => {
    const url = await start();
    for (const authorization of [undefined, "Bearer browser-jwt", "Basic token"]) {
      const response = await fetch(url, { headers: authorization ? { Authorization: authorization } : {} });
      expect(response.status).toBe(401); expect(response.headers.get("www-authenticate")).toContain("Bearer");
    }
    expect(repository.snapshot).not.toHaveBeenCalled();
  });
  it("serves non-cacheable Prometheus text at the root path", async () => {
    const response = await fetch(await start(), { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("content-type")).toContain("version=0.0.4");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("food_finance_cash_variance_paise 0");
  });
  it("returns an unavailable response without exposing collection errors", async () => {
    vi.mocked(repository.snapshot).mockRejectedValue(new Error("private database details"));
    const response = await fetch(await start(), { headers });
    expect(response.status).toBe(503); expect(await response.text()).toBe("finance metrics unavailable\n");
  });
});
