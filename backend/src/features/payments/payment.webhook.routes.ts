import { Router, raw } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import { requireRouteParam } from "../../utils/request";
import razorpayWebhookService from "./razorpay.webhook";
import { RealtimeRooms } from "../realtime/realtime-rooms";
import {
  RealtimeEvents,
  type RealtimeServer,
} from "../realtime/realtime.types";

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
      "finalizedNow" in reconciliation &&
      reconciliation.finalizedNow &&
      "localOrderId" in reconciliation &&
      typeof reconciliation.localOrderId === "number" &&
      "totalPrice" in reconciliation &&
      typeof reconciliation.totalPrice === "number"
    ) {
      const io = req.app.get("io") as RealtimeServer | undefined;
      const storeId =
        "storeId" in reconciliation &&
        typeof reconciliation.storeId === "number"
          ? reconciliation.storeId
          : undefined;
      const userId =
        "userId" in reconciliation && typeof reconciliation.userId === "number"
          ? reconciliation.userId
          : undefined;

      const audiences = [RealtimeRooms.platformAdmin()];
      if (storeId) audiences.push(RealtimeRooms.storeOrders(storeId));
      if (userId) audiences.push(RealtimeRooms.user(userId));

      io?.to(audiences).emit(RealtimeEvents.orderPlaced, {
        orderId: reconciliation.localOrderId,
        status: "pending",
        total: reconciliation.totalPrice,
        ...(storeId ? { storeId } : {}),
      });
    }

    res.json({ data, message: "Webhook accepted" });
  })
);
