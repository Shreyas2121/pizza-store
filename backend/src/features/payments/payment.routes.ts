import { Router } from "express";
import { AppError, asyncHandler } from "../../utils/error";
import { env } from "../../utils/zodSchema";
import crypto from "crypto";
import Razorpay from "razorpay";
import { authenticateUser } from "../../middleware/authenticeUser";
import { Auth } from "../../utils/types";
import paymentService from "./payment.service";

export const paymentRoutes = Router();

paymentRoutes.post(
  "/initiateRazorpay",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const { amount } = req.body;

    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY,
      key_secret: env.RAZORPAY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const paymentId = await paymentService.processPayment(order.id);

    res.json({
      data: {
        paymentId,
        orderId: order.id,
        amount: order.amount,
      },
    });
  })
);

paymentRoutes.post(
  "/validate",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      paymentId,
    } = req.body;

    const id = Number(paymentId);

    const sha = crypto.createHmac("sha256", env.RAZORPAY_SECRET);
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");

    if (digest !== razorpay_signature) {
      await paymentService.updatePayment(
        {
          status: "failed",
        },
        id
      );
      throw new AppError("Invalid payment signature", 401);
    }

    await paymentService.updatePayment(
      {
        paymentDate: new Date(),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "completed",
      },
      id
    );

    res.json({
      data: "Payment successful",
    });
  })
);
