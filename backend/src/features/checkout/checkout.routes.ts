import { Router } from "express";
import { authenticateUserOptional } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { checkoutQuoteSchema } from "../../utils/zodSchema";
import { asyncHandler } from "../../utils/error";
import type { AuthenticatedRequest } from "../../utils/types";
import checkoutService from "./checkout.service";
import { limitCouponValidation } from "../promotions/pricing";

export const checkoutRoutes = Router();

checkoutRoutes.post(
  "/quote",
  authenticateUserOptional,
  (req, res, next) =>
    req.body?.couponCode != null
      ? limitCouponValidation(req, res, next)
      : next(),
  validateBody(checkoutQuoteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { storeId, couponCode, destinationState, addressId, items } =
      req.body;
    const userId = req.principal?.userId;

    const quote = await checkoutService.calculatePublicQuote({
      storeId,
      couponCode,
      destinationState,
      addressId,
      items,
      userId,
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({
      data: quote,
    });
  }),
);
