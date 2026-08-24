import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { OrderStatus } from "../../utils/types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import { assertValidOrderTransition } from "./order.logic";

interface CreateCodOrderData {
  userId: number;
  addressId: number;
  couponCode?: string | null;
}

class OrderService {
  async createOrder(data: CreateCodOrderData) {
    return await db.transaction(async (tx) => {
      const quote = await checkoutService.buildQuote(data, tx);
      const payment = await paymentService.createPayment(
        {
          provider: "cod",
          status: "pending",
          amountPaise: quote.totalPaise,
          currency: "INR",
        },
        tx
      );

      const order = await checkoutService.createOrderSnapshot(
        quote,
        {
          userId: data.userId,
          addressId: data.addressId,
          paymentId: payment.id,
          paymentType: "cash",
          status: "pending",
        },
        tx
      );

      const lowStockAlerts = await inventoryService.deductStockForCod(
        {
          orderId: order.id,
          storeId: order.storeId,
          allocations: quote.stockAllocations,
        },
        tx
      );

      if (quote.coupon) {
        await checkoutService.recordCouponUse(
          {
            couponId: quote.coupon.id,
            orderId: order.id,
            userId: data.userId,
            status: "consumed",
          },
          tx
        );
      }

      await cartService.clearCart(data.userId, tx);

      return {
        id: order.id,
        paymentId: payment.id,
        totalPrice: order.totalPrice,
        lowStockAlerts,
      };
    });
  }

  async getOrders(userId: number, status?: OrderStatus) {
    return await db.query.ordersTable.findMany({
      where: status
        ? and(eq(ordersTable.status, status), eq(ordersTable.userId, userId))
        : eq(ordersTable.userId, userId),
      orderBy: desc(ordersTable.orderDate),
    });
  }

  async getAllUserOrders(userId: number) {
    return await db.query.ordersTable.findMany({
      where: eq(ordersTable.userId, userId),
      orderBy: desc(ordersTable.orderDate),
      with: {
        items: {
          with: {
            product: true,
            orderItemCustomizations: {
              with: {
                customizationOption: true,
              },
            },
          },
        },
      },
    });
  }

  async getOrderDetails(orderId: number) {
    return await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
      with: {
        address: true,
        coupon: true,
        items: {
          with: {
            product: true,
            orderItemCustomizations: {
              with: {
                customizationOption: true,
              },
            },
          },
        },
        payment: true,
        store: true,
      },
    });
  }

  async getAdminOrders(status: OrderStatus = "pending") {
    return await db.query.ordersTable.findMany({
      where: eq(ordersTable.status, status),
      with: {
        user: true,
      },
    });
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    adminUserId?: number
  ) {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .for("update")
        .limit(1);

      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (order.status === status) {
        return order;
      }

      assertValidOrderTransition(order.status, status);

      if (status === "cancelled") {
        await inventoryService.restoreStockForOrder(
          {
            orderId: order.id,
            createdBy: adminUserId ?? null,
          },
          tx
        );

        if (order.couponId) {
          await checkoutService.releaseCouponReservation(order.id, tx);
        }
      }

      const [updatedOrder] = await tx
        .update(ordersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId))
        .returning();

      return updatedOrder;
    });
  }
}

export { OrderService };
export default new OrderService();
