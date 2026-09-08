import { Router } from "express";
import { logger } from "../../utils/logger";
import { financeMetrics } from "./finance-metrics";
import financeMetricsRepository from "./finance-metrics.repository";

export const financeMetricsRoutes = Router();

financeMetricsRoutes.get("/metrics", async (_req, res) => {
  try {
    const snapshot = await financeMetricsRepository.snapshot();
    res.set({ "Cache-Control": "no-store", "Content-Type": "text/plain; version=0.0.4; charset=utf-8" })
      .send(financeMetrics.render(snapshot));
  } catch (cause) {
    logger.error("Finance metrics collection failed", {
      errorType: cause instanceof Error ? cause.constructor.name : typeof cause,
    });
    res.status(503).type("text/plain").send("finance metrics unavailable\n");
  }
});
