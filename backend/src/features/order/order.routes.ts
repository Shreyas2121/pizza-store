import { Router } from "express";
import {
  authenticateAdmin,
  authenticateUser,
} from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { createOrderSchema } from "../../utils/zodSchema";
import { AppError, asyncHandler } from "../../utils/error";
import { Auth, OrderStatus } from "../../utils/types";
import orderService from "./order.service";
import { io } from "../..";
import { parseIntegerParam } from "../../utils/request";

export const orderRoutes = Router();

orderRoutes.post(
  "/",
  authenticateUser,
  validateBody(createOrderSchema),
  asyncHandler(async (req: Auth, res) => {
    const userId = req.user!.id;

    const data = req.body;

    const order = await orderService.createOrder({
      addressId: data.addressId,
      couponCode: data.couponCode,
      userId,
    });

    io.emit("orderPlaced", {
      orderId: order.id,
      status: "pending",
      total: order.totalPrice,
    });

    if (order.lowStockAlerts?.length) {
      for (const alert of order.lowStockAlerts) {
        io.emit("lowStock", alert);
      }
    }

    res.json({
      data: order.id,
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

    const status = query.status ? (query.status as OrderStatus) : undefined;

    const orders = await orderService.getOrders(userId, status);

    res.json({
      data: orders,
    });
  })
);

orderRoutes.get(
  "/admin/all",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const query = req.query;
    const status = query.status as OrderStatus;

    const data = await orderService.getAdminOrders(status);

    res.json({
      data,
    });
  })
);

orderRoutes.get(
  "/:orderId",
  authenticateUser,
  asyncHandler(async (req: Auth, res) => {
    const orderId = parseIntegerParam(req.params.orderId, "Order ID");
    const order = await orderService.getOrderDetails(orderId);

    if (!order) throw new AppError("Order not found.");
    if (req.user!.role !== "admin" && order.userId !== req.user!.id) {
      throw new AppError("Order not found.", 404);
    }

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

//update order status

orderRoutes.patch(
  "/:orderId",
  authenticateAdmin,
  asyncHandler(async (req: Auth, res) => {
    const id = parseIntegerParam(req.params.orderId, "Order ID");

    const status = req.body.status as OrderStatus;

    await orderService.updateOrderStatus(id, status, req.user?.id);

    res.json({
      message: "Updated",
      data: id,
    });
  })
);
