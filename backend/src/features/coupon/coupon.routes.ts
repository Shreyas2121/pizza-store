import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { AppError, asyncHandler } from "../../utils/error";
import couponService from "./coupon.service";
import orderService from "../order/order.service";
import { parseIntegerParam, requireRouteParam } from "../../utils/request";

export const couponRoutes = Router();

couponRoutes.post(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const data = req.body;

    const date = new Date();
    const now = new Date();
    const defaultEndDate = new Date(now); // clone 'now'
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);

    const [coupon] = await couponService.createCoupon({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : date,
      endDate: data.endDate ? new Date(data.endDate) : defaultEndDate,
    });

    res.json({ data: coupon, message: "Coupon created successfully." });
  })
);

couponRoutes.get(
  "/",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const coupons = await couponService.getCoupons();

    res.json({ data: coupons });
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

    res.json({ data: coupon });
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

    res.json({ data: coupon });
  })
);

couponRoutes.put(
  "/:id",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const id = parseIntegerParam(req.params.id, "Coupon ID");
    const data = req.body;

    await couponService.updateCoupon(id, data);

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
  asyncHandler(async (req, res) => {
    const { code, total } = req.body;
    const coupon = await couponService.validateCoupon({ code, total });
    res.json({ data: coupon });
  })
);

couponRoutes.post(
  "/redeem",
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { code, orderId } = req.body;

    const coupon = await couponService.getCouponByCode(code);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    await couponService.updateCoupon(coupon.id, {
      redemptionCount: coupon.redemptionCount + 1,
    });

    res.json({ data: "Coupon redeemed" });
  })
);
