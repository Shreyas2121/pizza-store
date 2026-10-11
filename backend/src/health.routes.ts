import { Router } from "express";

export function createHealthRoutes(checkDatabase: () => Promise<unknown>) {
  const routes = Router();
  routes.get("/health/live", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ status: "ok" });
  });
  routes.get("/health/ready", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  return routes;
}
