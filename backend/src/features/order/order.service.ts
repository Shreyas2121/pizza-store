import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  ordersTable,
} from "../../db/schema";
import cartService from "../cart/cart.service";
import { OrderStatus } from "../../utils/types";
import checkoutService from "../checkout/checkout.service";
import paymentService from "../payments/payment.service";

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
      };
    });
  }

  async getOrders(userId: number, status?: OrderStatus) {
    return await db.query.ordersTable.findMany({
      where: status ? and(eq(ordersTable.status, status), eq(ordersTable.userId, userId)) : eq(ordersTable.userId, userId),
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

  async updateOrderStatus(orderId: number, status: OrderStatus) {
    return await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, orderId));
  }
}

export default new OrderService();
