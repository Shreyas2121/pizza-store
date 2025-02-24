import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticeUser";
import { AppError, asyncHandler } from "../../utils/error";
import { Auth } from "../../utils/types";
import orderService from "./order.service";

export const orderRoutes = Router();

orderRoutes.post(
  "/",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const data = req.body;

    const orderId = await orderService.createOrder({
      ...data,
      userId,
      status: "pending",
      discountAmount: 0,
    });

    res.json({
      data: orderId,
      message: "Order created successfully.",
    });
  })
);

orderRoutes.get(
  "/",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const query = req.query;

    const status = query.status ? (query.status as any) : "";

    const orders = await orderService.getOrders(userId, status);

    res.json({
      data: orders,
    });
  })
);

orderRoutes.get(
  "/:orderId",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const orderId = parseInt(req.params.orderId);
    const order = await orderService.getOrderDetails(orderId);

    if (!order) throw new AppError("Order not found.");

    const items = order.items.map((item) => {
      return {
        ...item,
        options: item.orderItemCustomizations.map((c) => c.customizationOption),
      };
    });

    res.json({
      data: {
        ...order,
        items,
      },
    });
  })
);
