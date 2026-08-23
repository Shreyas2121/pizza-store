import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  addressTable,
  deliveryZonesTable,
  orderItemCustomizationsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import cartService from "../cart/cart.service";
import { OrderStatus } from "../../utils/types";
import { formatStoreTime, isStoreOpen } from "../stores/store-hours";

type CreateOrderData = Omit<
  typeof ordersTable.$inferInsert,
  "storeId" | "addressId"
> & {
  addressId: number;
};

class OrderService {
  async createOrder(data: CreateOrderData) {
    return await db.transaction(async (tx) => {
      const cart = await cartService.getCart(data.userId, tx);

      if (!cart || cart.items.length === 0) {
        throw new AppError("Cart is empty", 400);
      }
      if (!cart.storeId || !cart.store) {
        throw new AppError("Cart is not assigned to a store", 409);
      }
      if (!cart.store.isActive) {
        throw new AppError("Store is no longer active", 409);
      }
      if (!isStoreOpen(cart.store.opensAt, cart.store.closesAt)) {
        throw new AppError(
          `Store is currently closed. Opens at ${formatStoreTime(cart.store.opensAt)} IST`,
          409
        );
      }

      const address = await tx.query.addressTable.findFirst({
        where: and(
          eq(addressTable.id, data.addressId),
          eq(addressTable.userId, data.userId)
        ),
      });

      if (!address) {
        throw new AppError("Delivery address not found", 404);
      }

      const deliveryZone = await tx.query.deliveryZonesTable.findFirst({
        where: and(
          eq(deliveryZonesTable.storeId, cart.storeId),
          eq(deliveryZonesTable.pincode, address.pincode)
        ),
      });

      if (!deliveryZone) {
        throw new AppError(
          "Delivery address is outside this store's delivery area",
          409
        );
      }

      const productIds = [...new Set(cart.items.map((item) => item.productId))];
      const storeProducts = await tx
        .select({
          productId: storeProductsTable.productId,
          isAvailable: storeProductsTable.isAvailable,
          productIsAvailable: productsTable.isAvailable,
        })
        .from(storeProductsTable)
        .innerJoin(
          productsTable,
          eq(storeProductsTable.productId, productsTable.id)
        )
        .where(
          and(
            eq(storeProductsTable.storeId, cart.storeId),
            inArray(storeProductsTable.productId, productIds)
          )
        );
      const availableProductIds = new Set(
        storeProducts
          .filter(
            (mapping) => mapping.isAvailable && mapping.productIsAvailable
          )
          .map((mapping) => mapping.productId)
      );
      const unavailableItems = [
        ...new Set(
          cart.items
            .filter((item) => !availableProductIds.has(item.productId))
            .map((item) => item.product.name)
        ),
      ];

      if (unavailableItems.length > 0) {
        throw new AppError(
          `Unavailable items: ${unavailableItems.join(", ")}`,
          409
        );
      }

      const [order] = await tx
        .insert(ordersTable)
        .values({ ...data, storeId: cart.storeId })
        .returning();

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

  async getOrderById(orderId: number) {
    return await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
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
