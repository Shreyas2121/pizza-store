import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable } from "../../db/schema";
import { AppError } from "../../utils/error";
import type { OrderStatus } from "../../utils/types";
import type { AuthPrincipal } from "../auth/auth.types";
import defaultAuthorizationService, {
  AuthorizationService,
} from "../access/access.service";
import defaultAuditService from "../audit/audit.service";
import type { AuditWriter } from "../audit/audit.types";
import cartService from "../cart/cart.service";
import checkoutService from "../checkout/checkout.service";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import { assertValidOrderTransition } from "./order.logic";
import { orderGrandTotalRupees, toOrderResponse } from "./order.mapper";

interface CreateCodOrderData {
  userId: number;
  addressId: number;
  couponCode?: string | null;
}

class OrderService {
  constructor(
    private readonly authorizationService: AuthorizationService = defaultAuthorizationService,
    private readonly auditService: AuditWriter = defaultAuditService
  ) {}

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
        storeId: order.storeId,
        paymentId: payment.id,
        totalPrice: orderGrandTotalRupees(order),
        lowStockAlerts,
      };
    });
  }

  async getOrders(userId: number, status?: OrderStatus) {
    const orders = await db.query.ordersTable.findMany({
      where: status
        ? and(eq(ordersTable.status, status), eq(ordersTable.userId, userId))
        : eq(ordersTable.userId, userId),
      orderBy: desc(ordersTable.orderDate),
    });
    return orders.map(toOrderResponse);
  }

  async getAllUserOrders(userId: number) {
    const orders = await db.query.ordersTable.findMany({
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
    return orders.map(toOrderResponse);
  }

  async getOrderDetails(orderId: number) {
    const order = await db.query.ordersTable.findFirst({
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
    return order ? toOrderResponse(order) : undefined;
  }

  async getAdminOrders({
    status = "pending",
    storeId,
  }: {
    status?: OrderStatus;
    storeId?: number;
  } = {}) {
    const conditions = [];
    if (status) {
      conditions.push(eq(ordersTable.status, status));
    }
    if (storeId !== undefined) {
      conditions.push(eq(ordersTable.storeId, storeId));
    }

    const orders = await db.query.ordersTable.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(ordersTable.orderDate),
      with: {
        user: true,
        store: true,
      },
    });
    return orders.map(toOrderResponse);
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    actor?: AuthPrincipal | number
  ) {
    const principal: AuthPrincipal | undefined =
      typeof actor === "object"
        ? actor
        : typeof actor === "number"
        ? { userId: actor, email: "", platformRole: "admin", tokenVersion: 0 }
        : undefined;

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

      if (principal) {
        await this.authorizationService.requireStorePermission({
          principal,
          storeId: order.storeId,
          permission: "orders.update_status",
          tx,
        });
      }

      if (order.status === status) {
        return order;
      }

      assertValidOrderTransition(order.status, status);

      if (status === "cancelled") {
        await inventoryService.restoreStockForOrder(
          {
            orderId: order.id,
            createdBy: principal?.userId ?? null,
          },
          tx
        );

        if (order.couponId) {
          await checkoutService.releaseCouponReservation(order.id, tx);
        }
      }

      if (status === "delivered" && order.paymentType === "cash") {
        if (!order.paymentId) {
          throw new AppError(
            "COD order has no linked payment",
            409,
            "COD_PAYMENT_NOT_FOUND"
          );
        }

        const paidAt = new Date();
        const [completedPayment] = await tx
          .update(paymentsTable)
          .set({
            status: "completed",
            paidAt,
            paymentDate: paidAt,
            failedAt: null,
            failureCode: null,
            failureDescription: null,
            updatedAt: paidAt,
          })
          .where(
            and(
              eq(paymentsTable.id, order.paymentId),
              eq(paymentsTable.provider, "cod")
            )
          )
          .returning({ id: paymentsTable.id });

        if (!completedPayment) {
          throw new AppError(
            "COD payment not found",
            409,
            "COD_PAYMENT_NOT_FOUND"
          );
        }
      }

      const now = new Date();
      const orderUpdates: Partial<typeof ordersTable.$inferInsert> = {
        status,
        updatedAt: now,
      };

      if (status === "delivered") {
        orderUpdates.deliveredAt = order.deliveredAt ?? now;
        orderUpdates.recognizedAt = order.recognizedAt ?? now;
      } else if (status === "cancelled") {
        orderUpdates.cancelledAt = order.cancelledAt ?? now;
      }

      const [updatedOrder] = await tx
        .update(ordersTable)
        .set(orderUpdates)
        .where(eq(ordersTable.id, orderId))
        .returning();

      if (principal) {
        await this.auditService.write({
          tx,
          actor: principal,
          storeId: order.storeId,
          action: "order.status.updated",
          resourceType: "order",
          resourceId: order.id,
          before: { status: order.status },
          after: { status: updatedOrder.status },
          metadata: {
            orderId: order.id,
            paymentId: order.paymentId,
            customerUserId: order.userId,
          },
        });
      }

      return updatedOrder;
    });
  }
}

export { OrderService };
export default new OrderService();
