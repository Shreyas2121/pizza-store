import { createHash, timingSafeEqual } from "crypto";
import { Router, type RequestHandler } from "express";
import { logger } from "../../utils/logger";
import { env } from "../../utils/zodSchema";
import { financeMetrics } from "./finance-metrics";
import financeMetricsRepository from "./finance-metrics.repository";

export const financeMetricsRoutes = Router();

const tokensMatch = (expected: string, provided: string) => {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
};

export const requireMetricsBearer = (expectedToken?: string): RequestHandler => (req, res, next) => {
  if (!expectedToken) {
    return res.status(503).type("text/plain").send("finance metrics authentication is not configured\n");
  }

  const authorization = req.get("Authorization");
  const providedToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!providedToken || !tokensMatch(expectedToken, providedToken)) {
    res.set("WWW-Authenticate", 'Bearer realm="metrics"');
    return res.status(401).type("text/plain").send("authentication required\n");
  }

  next();
};

financeMetricsRoutes.get("/metrics", requireMetricsBearer(env.METRICS_BEARER_TOKEN), async (_req, res) => {
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
