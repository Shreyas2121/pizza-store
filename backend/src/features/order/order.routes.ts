import { Router } from "express";
import { authenticateUser } from "../../middleware/authenticateUser";
import { validateBody } from "../../middleware/validateBody";
import { createOrderSchema } from "../../utils/zodSchema";
import { AppError, asyncHandler } from "../../utils/error";
import type { AuthenticatedRequest, OrderStatus } from "../../utils/types";
import authorizationService, { authenticationRequired } from "../access/access.service";
import orderService from "./order.service";
import { io } from "../..";
import { parseIntegerParam } from "../../utils/request";

export const orderRoutes = Router();

orderRoutes.post(
  "/",
  authenticateUser,
  validateBody(createOrderSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();
    const userId = req.principal.userId;

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
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();
    const userId = req.principal.userId;

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
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();
    const status = req.query.status as OrderStatus | undefined;
    const isPlatformAdmin = req.principal.platformRole === "admin";

    let storeId: number | undefined;
    if (req.query.storeId !== undefined) {
      if (typeof req.query.storeId !== "string") {
        throw new AppError("Store ID must be a positive integer", 400);
      }
      storeId = parseIntegerParam(req.query.storeId, "Store ID");
    }

    if (!isPlatformAdmin) {
      if (storeId === undefined) {
        throw new AppError(
          "Store ID is required for store staff order queries",
          400,
          "STORE_ID_REQUIRED"
        );
      }
      await authorizationService.requireStorePermission({
        principal: req.principal,
        storeId,
        permission: "orders.read",
      });
    }

    const data = await orderService.getAdminOrders({
      status,
      storeId,
    });

    res.json({
      data,
    });
  })
);

orderRoutes.get(
  "/:orderId",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();
    const orderId = parseIntegerParam(req.params.orderId, "Order ID");
    const order = await orderService.getOrderDetails(orderId);

    if (!order) throw new AppError("Order not found.", 404, "ORDER_NOT_FOUND");

    const isOwner = order.userId === req.principal.userId;
    const isPlatformAdmin = req.principal.platformRole === "admin";

    if (!isOwner && !isPlatformAdmin) {
      await authorizationService.requireResourceStorePermission({
        principal: req.principal,
        resourceStoreId: order.storeId,
        permission: "orders.read",
      });
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

// Update order status
orderRoutes.patch(
  "/:orderId",
  authenticateUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.principal) throw authenticationRequired();
    const id = parseIntegerParam(req.params.orderId, "Order ID");

    const status = req.body.status as OrderStatus;

    await orderService.updateOrderStatus(id, status, req.principal);

    res.json({
      message: "Updated",
      data: id,
    });
  })
);
