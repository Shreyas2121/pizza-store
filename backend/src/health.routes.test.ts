import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createHealthRoutes } from "./health.routes";

let server: Server;
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function start(check: () => Promise<unknown>) {
  const app = express();
  app.use(createHealthRoutes(check));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
}

describe("deployment health endpoints", () => {
  it("reports ready when the database responds", async () => {
    const origin = await start(async () => undefined);
    const response = await fetch(`${origin}/health/ready`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("reports unavailable without leaking errors, while liveness stays healthy", async () => {
    const origin = await start(async () => { throw new Error("secret connection details"); });
    const response = await fetch(`${origin}/health/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect((await fetch(`${origin}/health/live`)).status).toBe(200);
  });
});
