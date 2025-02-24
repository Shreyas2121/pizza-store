import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  orderItemCustomizationsTable,
  orderItemsTable,
  ordersTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import cartService from "../cart/cart.service";
import { OrderStatus } from "../../utils/types";

class OrderService {
  async createOrder(data: typeof ordersTable.$inferInsert) {
    const cart = await cartService.getCart(data.userId);

    if (!cart) {
      throw new AppError("No Cart Found.");
    }

    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(ordersTable).values(data).returning();

      await Promise.all(
        cart.items.map(async (item) => {
          const [cartItem] = await tx
            .insert(orderItemsTable)
            .values({
              orderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })
            .returning();

          await Promise.all(
            item.customizations.map(async (c) => {
              return await tx.insert(orderItemCustomizationsTable).values({
                customizationOptionId: c.customizationOptionId,
                orderItemId: cartItem.id,
                price: c.price,
              });
            })
          );
        })
      );

      await cartService.clearCart(data.userId, tx);

      return order.id;
    });
  }

  async getOrders(userId: number, status: OrderStatus = "pending") {
    return await db.query.ordersTable.findMany({
      where: and(
        eq(ordersTable.status, status),
        eq(ordersTable.userId, userId)
      ),
      orderBy: desc(ordersTable.orderDate),
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
      },
    });
  }

  async getOrderById(orderId: number) {
    return await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
    });
  }
}

export default new OrderService();
