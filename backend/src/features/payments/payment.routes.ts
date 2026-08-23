import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { asyncHandler } from "../../utils/error";
import { parseIntegerParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import {
  initiateRazorpayOrderSchema,
  reconcileRazorpayPaymentsSchema,
  verifyRazorpayPaymentSchema,
} from "../../utils/zodSchema";
import paymentService from "./payment.service";
import { isRazorpayCheckoutEnabled } from "./razorpay.config";
import { io } from "../..";

export const paymentRoutes = Router();

paymentRoutes.get("/methods", (_req, res) => {
  res.json({
    data: {
      cash: true,
      razorpay: isRazorpayCheckoutEnabled(),
    },
  });
});

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
        io.emit("orderPlaced", {
          orderId: result.localOrderId,
          status: "pending",
          total: result.totalPrice,
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
      userId: req.user!.id,
      localOrderId: req.body.localOrderId,
      razorpayOrderId: req.body.razorpay_order_id,
      razorpayPaymentId: req.body.razorpay_payment_id,
      razorpaySignature: req.body.razorpay_signature,
    });

    if (data.finalizedNow) {
      io.emit("orderPlaced", {
        orderId: data.localOrderId,
        status: data.orderStatus,
        total: data.totalPrice,
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
      userId: req.user!.id,
      addressId: req.body.addressId,
      couponCode: req.body.couponCode,
      clientRequestId: req.body.clientRequestId,
    });

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
    const data = await paymentService.getRazorpayOrderStatus(
      localOrderId,
      req.user!.id
    );

    res.json({ data });
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
      req.user!.id
    );

    res.json({ data, message: "Online payment is ready" });
  })
);
