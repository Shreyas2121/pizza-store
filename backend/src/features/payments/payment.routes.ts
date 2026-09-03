import { Router } from "express";
import { authenticateAdmin, authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import {
  initiateRazorpayOrderSchema,
  reconcileRazorpayPaymentsSchema,
  runPaymentSimulatorSchema,
  verifyRazorpayPaymentSchema,
} from "../../utils/zodSchema";
import { AppError, asyncHandler } from "../../utils/error";
import type { Auth } from "../../utils/types";
import { parseIntegerParam } from "../../utils/request";
import paymentService from "./payment.service";
import paymentSimulatorService from "./payment-simulator.service";
import { io } from "../..";
import { RealtimeRooms } from "../realtime/realtime-rooms";

export const paymentRoutes = Router();

paymentRoutes.get(
  "/methods",
  asyncHandler(async (_req, res) => {
    res.json({ data: paymentService.getPaymentMethods() });
  })
);

paymentRoutes.post(
  "/simulator/orders/:localOrderId/events",
  authenticateUser,
  validateBody(runPaymentSimulatorSchema),
  asyncHandler(async (req: Auth, res) => {
    const localOrderId = parseIntegerParam(req.params.localOrderId, "Order ID");
    const data = await paymentSimulatorService.advance(
      localOrderId,
      req.principal!.userId,
      req.body.scenario
    );
    const reconciliation = data.reconciliation;
    if (
      reconciliation &&
      reconciliation.finalizedNow &&
      "localOrderId" in reconciliation &&
      "totalPrice" in reconciliation
    ) {
      const storeAudience =
        "storeId" in reconciliation && reconciliation.storeId
          ? RealtimeRooms.storeOrders(reconciliation.storeId as number)
          : RealtimeRooms.platformAdmin();
      io.to([
        RealtimeRooms.user(req.principal!.userId),
        storeAudience,
        RealtimeRooms.platformAdmin(),
      ]).emit("orderPlaced", {
        orderId: reconciliation.localOrderId,
        status: reconciliation.orderStatus,
        total: reconciliation.totalPrice,
        ...("storeId" in reconciliation && reconciliation.storeId
          ? { storeId: reconciliation.storeId }
          : {}),
      });
    }
    res.json({ data, message: "Simulator event processed" });
  })
);

paymentRoutes.post(
  "/razorpay/reconcile",
  authenticateAdmin,
  validateBody(reconcileRazorpayPaymentsSchema),
  asyncHandler(async (req, res) => {
    const data = await paymentService.reconcileStalePayments(
      req.body.olderThanMinutes,
      req.body.limit
    );

    for (const result of data.results) {
      if (
        result.finalizedNow &&
        result.localOrderId &&
        result.totalPrice !== undefined
      ) {
        const storeAudience =
          "storeId" in result && result.storeId
            ? RealtimeRooms.storeOrders(result.storeId as number)
            : RealtimeRooms.platformAdmin();
        const userAudience =
          "userId" in result && result.userId
            ? RealtimeRooms.user(result.userId as number)
            : RealtimeRooms.platformAdmin();

        io.to([
          userAudience,
          storeAudience,
          RealtimeRooms.platformAdmin(),
        ]).emit("orderPlaced", {
          orderId: result.localOrderId,
          status: "pending",
          total: result.totalPrice,
          ...("storeId" in result && result.storeId
            ? { storeId: result.storeId }
            : {}),
        });
      }
    }

    res.json({ data, message: "Payment reconciliation completed" });
  })
);

paymentRoutes.post(
  "/razorpay/verify",
  authenticateUser,
  validateBody(verifyRazorpayPaymentSchema),
  asyncHandler(async (req: Auth, res) => {
    const data = await paymentService.verifyRazorpayPayment({
      userId: req.principal!.userId,
      localOrderId: req.body.localOrderId,
      razorpayOrderId: req.body.razorpay_order_id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      razorpaySignature: req.body.razorpay_signature,
    });

    if (data.finalizedNow) {
      const storeAudience =
        "storeId" in data && data.storeId
          ? RealtimeRooms.storeOrders(data.storeId as number)
          : RealtimeRooms.platformAdmin();

      io.to([
        RealtimeRooms.user(req.principal!.userId),
        storeAudience,
        RealtimeRooms.platformAdmin(),
      ]).emit("orderPlaced", {
        orderId: data.localOrderId,
        status: data.orderStatus,
        total: data.totalPrice,
        ...("storeId" in data && data.storeId
          ? { storeId: data.storeId }
          : {}),
      });
    }

    res.json({ data, message: "Payment verified successfully" });
  })
);

paymentRoutes.post(
  "/razorpay/orders",
  authenticateUser,
  validateBody(initiateRazorpayOrderSchema),
  asyncHandler(async (req: Auth, res) => {
    const data = await paymentService.initiateRazorpayOrder({
      userId: req.principal!.userId,
      addressId: req.body.addressId,
      couponCode: req.body.couponCode,
      clientRequestId: req.body.clientRequestId,
    });

    if (data.lowStockAlerts?.length) {
      for (const alert of data.lowStockAlerts) {
        io.to([
          RealtimeRooms.storeInventory(alert.storeId),
          RealtimeRooms.platformAdmin(),
        ]).emit("lowStock", alert);
      }
    }

    res.json({ data, message: "Online payment initialized" });
  })
);

paymentRoutes.get(
  "/razorpay/orders/:localOrderId",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const localOrderId = parseIntegerParam(
      req.params.localOrderId,
      "Order ID"
    );

    const payment = await paymentService.getRazorpayOrderStatus(
      localOrderId,
      req.principal!.userId
    );

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    res.json({ data: payment });
  })
);

paymentRoutes.post(
  "/razorpay/orders/:localOrderId/retry",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const localOrderId = parseIntegerParam(
      req.params.localOrderId,
      "Order ID"
    );

    const data = await paymentService.retryRazorpayOrder(
      localOrderId,
      req.principal!.userId
    );

    res.json({ data, message: "Online payment retried" });
  })
);

