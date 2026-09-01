import { Router } from "express";
import { authenticateUserOptional } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { checkoutQuoteSchema } from "../../utils/zodSchema";
import { asyncHandler } from "../../utils/error";
import type { AuthenticatedRequest } from "../../utils/types";
import checkoutService from "./checkout.service";

export const checkoutRoutes = Router();

checkoutRoutes.post(
  "/quote",
  authenticateUserOptional,
  validateBody(checkoutQuoteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { storeId, couponCode, destinationState, addressId, items } = req.body;
    const userId = req.principal?.userId;

    const quote = await checkoutService.calculatePublicQuote({
      storeId,
      couponCode,
      destinationState,
      addressId,
      items,
      userId,
    });

    res.json({
      data: quote,
    });
  })
);
