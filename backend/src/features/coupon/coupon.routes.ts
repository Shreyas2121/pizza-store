import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { AppError, asyncHandler } from "../../utils/error";
import couponService from "./coupon.service";
import checkoutService from "../checkout/checkout.service";
import { parseIntegerParam, requireRouteParam } from "../../utils/request";
import type { Auth } from "../../utils/types";
import { validateBody } from "../../middleware/validateBody";
import { createCouponSchema, validateCouponSchema } from "../../utils/zodSchema";
import { toCouponResponse, toLegacyCouponValidationResponse } from "./coupon.compatibility";
import { rupeesToPaise } from "../../utils/money";

const toCouponWrite = (data: typeof createCouponSchema._output) => ({
  code: data.code.trim().toUpperCase(),
  discountType: data.discountType,
  discountRateBps: data.discountType === "percentage" ? rupeesToPaise(data.discountValue) : null,
  discountAmountPaise: data.discountType === "fixed" ? rupeesToPaise(data.discountValue) : null,
  minimumOrderPaise: rupeesToPaise(data.minOrderValue ?? 0),
  maxRedemptions: data.maxRedemptions,
});

export const couponRoutes = Router();

couponRoutes.post(
  "/",
  authenticateAdmin,
  validateBody(createCouponSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;

    const date = new Date();
    const now = new Date();
    const defaultEndDate = new Date(now); // clone 'now'
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);

    const [coupon] = await couponService.createCoupon({
      ...toCouponWrite(data),
      startDate: data.startDate ? new Date(data.startDate) : date,
      endDate: data.endDate ? new Date(data.endDate) : defaultEndDate,
    });

    res.json({ data: toCouponResponse(coupon), message: "Coupon created successfully." });
  })
);

couponRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const coupons = await couponService.getCoupons();

    res.json({ data: coupons.map(toCouponResponse) });
  })
);

couponRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Coupon ID");

    const coupon = await couponService.getCouponById(id);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    res.json({ data: toCouponResponse(coupon) });
  })
);

couponRoutes.get(
  "/code/:code",
  asyncHandler(async (req, res) => {
    const code = requireRouteParam(req.params.code, "Coupon code");

    const coupon = await couponService.getCouponByCode(code);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    res.json({ data: toCouponResponse(coupon) });
  })
);

couponRoutes.put(
  "/:id",
  authenticateAdmin,
  validateBody(createCouponSchema.partial()),
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Coupon ID");
    const data = req.body;

    const current = await couponService.getCouponById(id);
    if (!current) throw new AppError("Coupon not found", 404);
    const merged = createCouponSchema.parse({
      ...toCouponResponse(current),
      ...data,
      startDate: data.startDate ?? current.startDate.toISOString(),
      endDate: data.endDate ?? current.endDate.toISOString(),
    });
    await couponService.updateCoupon(id, {
      ...toCouponWrite(merged),
      startDate: new Date(merged.startDate ?? current.startDate),
      endDate: new Date(merged.endDate ?? current.endDate),
    });

    res.json({ data: "Coupon updated" });
  })
);

couponRoutes.delete(
  "/:id",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Coupon ID");

    await couponService.deleteCoupon(id);

    res.json({ data: "Coupon deleted" });
  })
);

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
