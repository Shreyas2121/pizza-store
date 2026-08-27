import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { logger } from "./utils/logger";
import { handleError } from "./utils/error";
import { mainRoutes } from "./routes";
import { Server } from "socket.io";
import http from "http";
import { env } from "./utils/zodSchema";
import { paymentWebhookRoutes } from "./features/payments/payment.webhook.routes";
import { checkDatabaseConnection, closeDatabase } from "./db";
import path from "path";

import { createSocketAuthMiddleware } from "./features/realtime/realtime-auth";
import { setRealtimeIoGetter } from "./features/staff/staff.realtime";

logger.info("🚀 [Startup] Initializing Food Delivery Backend service...");
logger.info(
  `⚙️  [Config] Port: ${env.PORT || 3000} | Env: ${
    process.env.NODE_ENV || "development"
  } | Frontend: ${env.FE_URL}`
);
logger.info(
  `💳 [Config] Razorpay: ${
    env.RAZORPAY_ENABLED ? "ENABLED" : "DISABLED (Cash on delivery only)"
  }`
);

const app = express();
const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: env.FE_URL,
    credentials: true,
  },
});

setRealtimeIoGetter(() => io);

io.use(createSocketAuthMiddleware());

io.on("connection", (socket) => {
  logger.info(`🔌 [Socket.io] Client connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    logger.info(
      `🔌 [Socket.io] Client disconnected: ${socket.id} (reason: ${reason})`
    );
  });
});

// Razorpay signatures cover the exact request bytes. This route must remain
// ahead of every middleware that parses or transforms JSON request bodies.
app.use("/api/v1/payments/razorpay/webhook", paymentWebhookRoutes);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: env.FE_URL, credentials: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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
  handleError(err, req, res);
});

const port = Number(process.env.PORT || env.PORT || 3000);

app.set("io", io);

httpServer.listen(port, async () => {
  logger.info(`✨ [Server] HTTP server is live and listening on http://localhost:${port}`);
  logger.info(`📡 [API] REST endpoints ready at http://localhost:${port}/api/v1`);
  logger.info(`🔌 [Socket.io] Realtime WebSocket gateway ready`);

  // Explicitly test and log database connectivity and latency on startup
  await checkDatabaseConnection();
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
  logger.info("🛑 [Process] SIGINT received. Shutting down gracefully...");
  await closeDatabase().catch(() => {});
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("🛑 [Process] SIGTERM received. Shutting down gracefully...");
  await closeDatabase().catch(() => {});
  process.exit(0);
});
