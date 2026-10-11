import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { logger } from "./utils/logger";
import { handleErrorWithAudit } from "./utils/error";
import { mainRoutes } from "./routes";
import { Server } from "socket.io";
import * as msgpackParser from "socket.io-msgpack-parser";
import http from "http";
import { env } from "./utils/zodSchema";
import { paymentWebhookRoutes } from "./features/payments/payment.webhook.routes";
import { checkDatabaseConnection, closeDatabase, pool } from "./db";
import { initializeStorage, uploadsDirectory } from "./utils/storage-paths";
import { createHealthRoutes } from "./health.routes";
import { startMaintenance } from "./utils/maintenance";
import { commercePostingWorker } from "./features/finance-events/commerce-posting.runtime";
import paymentService from "./features/payments/payment.service";
import { randomUUID } from "node:crypto";
import { redirectPromotionImage } from "./utils/cloudinary-storage";
import { requestContextMiddleware } from "./utils/request-context";
import { financeMetricsRoutes } from "./features/observability/finance-metrics.routes";

import { createSocketAuthMiddleware } from "./features/realtime/realtime-auth";
import { setRealtimeServerGetter } from "./features/realtime/realtime-server";
import type {
  ClientToServerEvents,
  InterServerEvents,
  RealtimeSocketData,
  ServerToClientEvents,
} from "./features/realtime/realtime.types";

logger.info("🚀 [Startup] Initializing Food Delivery Backend service...");
logger.info(
  `⚙️  [Config] Port: ${env.PORT || 3000} | Env: ${
    process.env.NODE_ENV || "development"
  } | Frontend: ${env.FE_URL}`
);
logger.info(
  `💳 [Config] Online payment: ${
    env.PAYMENT_PROVIDER_MODE === "simulator"
      ? "SIMULATOR (credential-free demo)"
      : env.RAZORPAY_ENABLED
        ? "TEST MODE ENABLED"
        : "TEST MODE DISABLED"
  }`
);

const app = express();
const httpServer = http.createServer(app);
export const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  RealtimeSocketData
>(httpServer, {
  parser: msgpackParser,
  cors: {
    origin: env.FE_URL,
    credentials: true,
  },
});

setRealtimeServerGetter(() => io);

io.use(createSocketAuthMiddleware());

io.on("connection", (socket) => {
  logger.info(`🔌 [Socket.io] Client connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    logger.info(
      `🔌 [Socket.io] Client disconnected: ${socket.id} (reason: ${reason})`
    );
  });
});

app.use(requestContextMiddleware);
app.use(createHealthRoutes(async () => {
  const query = { text: "SELECT 1", query_timeout: 5000 };
  await pool.query(query);
}));
app.use(financeMetricsRoutes);

// Razorpay signatures cover the exact request bytes. This route must remain
// ahead of every middleware that parses or transforms JSON request bodies.
app.use("/api/v1/payments/razorpay/webhook", paymentWebhookRoutes);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: env.FE_URL, credentials: true }));
app.use("/uploads", express.static(uploadsDirectory()));
app.get("/uploads/promotions/:key", redirectPromotionImage);

// HTTP Request logging with duration and status code
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logMethod =
      statusCode >= 500
        ? logger.error.bind(logger)
        : statusCode >= 400
        ? logger.warn.bind(logger)
        : logger.info.bind(logger);

    logMethod(
      `🌐 [HTTP] ${req.method} ${req.originalUrl || req.url} -> ${statusCode} (${duration}ms)`
    );
  });
  next();
});

app.use("/api/v1", mainRoutes);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  void handleErrorWithAudit(err, req, res);
});

const port = Number(process.env.PORT || env.PORT || 3000);

app.set("io", io);

async function start() {
  await initializeStorage();
  if (!await checkDatabaseConnection()) {
    throw new Error("Database unavailable; refusing to start");
  }
  httpServer.listen(port, "0.0.0.0", () => {
    if (env.MAINTENANCE_ENABLED) {
      const workerId = `web-ledger-${randomUUID()}`;
      stopMaintenance = startMaintenance([
        { name: "financial-posting", intervalMs: 60_000, run: () => commercePostingWorker.runOnce(workerId, 25) },
        { name: "reservation-recovery", intervalMs: 300_000, run: () => paymentService.reconcileExpiredReservations(25) },
        ...(env.PAYMENT_PROVIDER_MODE === "razorpay_test" ? [
          { name: "payment-recovery", intervalMs: 300_000, run: () => paymentService.reconcileStalePayments(15, 25) },
        ] : []),
      ]);
    }
    logger.info(`✨ [Server] HTTP server is live and listening on http://localhost:${port}`);
    logger.info(`📡 [API] REST endpoints ready at http://localhost:${port}/api/v1`);
    logger.info(`🔌 [Socket.io] Realtime WebSocket gateway ready`);
  });
}

let stopMaintenance = async () => {};
httpServer.on("error", (error) => {
  logger.error("HTTP server failed", { message: error.message });
  process.exit(1);
});
void start().catch(async (error: unknown) => {
  logger.error("Backend startup failed", { message: error instanceof Error ? error.message : "Unknown startup error" });
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});

// Process-level error and shutdown monitoring
process.on("unhandledRejection", (reason: any) => {
  logger.error(
    `💥 [Process] Unhandled Promise Rejection: ${
      reason?.message || JSON.stringify(reason)
    }`,
    { stack: reason?.stack }
  );
});

process.on("uncaughtException", (error: Error) => {
  logger.error(`💥 [Process] Uncaught Exception: ${error.message}`, {
    stack: error.stack,
  });
});

process.on("SIGINT", async () => {
  await stopMaintenance();
  logger.info("🛑 [Process] SIGINT received. Shutting down gracefully...");
  await closeDatabase().catch(() => {});
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await stopMaintenance();
  logger.info("🛑 [Process] SIGTERM received. Shutting down gracefully...");
  await closeDatabase().catch(() => {});
  process.exit(0);
});
