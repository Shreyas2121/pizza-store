import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { AppError, asyncHandler } from "../../utils/error";
import checkoutService from "../checkout/checkout.service";
import type { Auth } from "../../utils/types";
import { validateBody } from "../../middleware/validateBody";
import { validateCouponSchema } from "../../utils/zodSchema";
import { toLegacyCouponValidationResponse } from "./coupon.compatibility";

export const couponRoutes = Router();

couponRoutes.post(
  "/validate",
  authenticateUser,
  validateBody(validateCouponSchema),
  asyncHandler(async (req: Auth, res) => {
    const { code } = req.body;
    const { couponRecord, quote } = await checkoutService.previewCoupon(
      req.principal!.userId,
      code
    );
    if (!couponRecord) {
      throw new AppError("Coupon not found", 404);
    }
    res.json({
      data: toLegacyCouponValidationResponse(couponRecord, quote),
    });
  })
);
