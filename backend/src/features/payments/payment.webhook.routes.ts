import { Router, raw } from "express";
import type { Server } from "socket.io";
import { AppError, asyncHandler } from "../../utils/error";
import { requireRouteParam } from "../../utils/request";
import razorpayWebhookService from "./razorpay.webhook";
import { RealtimeRooms } from "../realtime/realtime-rooms";

export const paymentWebhookRoutes = Router();

paymentWebhookRoutes.post(
  "/",
  raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError("Webhook body must be raw JSON", 400);
    }
    const signature = requireRouteParam(
      req.headers["x-razorpay-signature"],
      "X-Razorpay-Signature"
    );
    const eventId = requireRouteParam(
      req.headers["x-razorpay-event-id"],
      "x-razorpay-event-id"
    );
    if (eventId.length > 255) {
      throw new AppError("Webhook event ID is too long", 400);
    }

    const data = await razorpayWebhookService.handle(
      req.body,
      signature,
      eventId
    );
    const reconciliation = data.reconciliation;
    if (
      reconciliation &&
      reconciliation.finalizedNow &&
      "localOrderId" in reconciliation &&
      "totalPrice" in reconciliation
    ) {
      const io = req.app.get("io") as Server | undefined;
      const storeId =
        "storeId" in reconciliation
          ? (reconciliation as any).storeId
          : undefined;
      const userId =
        "userId" in reconciliation
          ? (reconciliation as any).userId
          : undefined;

      const audiences = [RealtimeRooms.platformAdmin()];
      if (storeId) audiences.push(RealtimeRooms.storeOrders(storeId));
      if (userId) audiences.push(RealtimeRooms.user(userId));

      io?.to(audiences).emit("orderPlaced", {
        orderId: reconciliation.localOrderId,
        status: "pending",
        total: reconciliation.totalPrice,
        ...(storeId ? { storeId } : {}),
      });
    }

    res.json({ data, message: "Webhook accepted" });
  })
);
