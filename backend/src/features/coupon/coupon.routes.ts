import { Router } from "express";
import { authenticateAdmin } from "../../middleware/authenticeUser";
import { AppError, asyncHandler } from "../../utils/error";
import couponService from "./coupon.service";
import orderService from "../order/order.service";

export const couponRoutes = Router();

couponRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = req.body;

    const date = new Date();
    const now = new Date();
    const defaultEndDate = new Date(now); // clone 'now'
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);

    const [coupon] = await couponService.createCoupon({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : date,
      endDate: data.endDate
        ? new Date(data.endDate)
        : defaultEndDate
    });

    res.json({ data: coupon, message: "Coupon created successfully." });
  })
);

couponRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const coupons = await couponService.getCoupons();

    res.json({ data: coupons });
  })
);

couponRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

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
    const code = req.params.code;

    const coupon = await couponService.getCouponByCode(code);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    res.json({ data: coupon });
  })
);

couponRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const data = req.body;

    await couponService.updateCoupon(id, data);

    res.json({ data: "Coupon updated" });
  })
);

couponRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    await couponService.deleteCoupon(id);

    res.json({ data: "Coupon deleted" });
  })
);

couponRoutes.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const { code, total } = req.body;

    const coupon = await couponService.getCouponByCode(code);

    if (!coupon) {
      throw new AppError("Coupon not found", 404);
    }

    const now = new Date();

    // Check if the coupon is active
    if (!coupon.isActive) {
      throw new AppError("Coupon is not active", 400);
    }

    // Check if the coupon is within the valid date range
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError("Coupon is expired or not yet valid", 400);
    }

    // Check if the coupon has reached its maximum redemption limit
    if (coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new AppError("Coupon maximum redemption limit reached", 400);
    }

    // Check if the order total meets the minimum spend requirement
    if (total < coupon.minOrderValue) {
      throw new AppError(
        `Minimum order value of ${coupon.minOrderValue} not met`,
        400
      );
    }

    res.json({ data: coupon });
  })
);

couponRoutes.post(
  "/redeem",
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
