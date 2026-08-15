import { Router } from "express";
import { asyncHandler } from "../../utils/error";
import { authenticateUser } from "../../middleware/authenticateUser";
import { Auth } from "../../utils/types";
import paymentService from "./payment.service";

export const paymentRoutes = Router();

paymentRoutes.post(
  "/process-cod",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const paymentId = await paymentService.processPayment();

    res.json({
      data: {
        paymentId,
        paymentType: "cash",
        message: "Cash on Delivery selected successfully",
      },
    });
  })
);
