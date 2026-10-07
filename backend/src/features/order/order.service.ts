import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { ordersTable, paymentsTable, paymentAttemptsTable } from "../../db/schema";
import paymentRepository from "../payments/payment.repository";
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
import { codCheckoutService } from "../checkout";
import inventoryService from "../inventory/inventory.service";
import paymentService from "../payments/payment.service";
import { assertValidOrderTransition } from "./order.logic";
import { orderGrandTotalRupees, toOrderResponse } from "./order.mapper";
import { ORDER_SNAPSHOT_RELATIONS } from "./order-read.repository";
import { ORDER_LIST_DEFAULT_LIMIT } from "./order.constants";
import defaultCostService, {
  type CostSnapshotWriter,
  type OrderCostSnapshot,
} from "../costs/cost.service";
import financialEventService from "../finance-events/financial-event.service";
import type { FinancialEventWriter } from "../finance-events/financial-event.types";
import cashService, { type CashSourceWriter } from "../cash-management/cash.service";
import { businessDateFor } from "../../utils/business-date";
import { PRICING_POLICY_VERSION } from "../pricing";
import { buildDeliveredOrderPayload } from "../finance-events/order-recognition.payload";
import { promotionApplicationService, PromotionApplicationRepository } from "../promotions/applications";

interface CreateCodOrderData {
  userId: number;
  addressId: number;
  couponCode?: string | null;
}

class OrderService {
  constructor(
    private readonly authorizationService: AuthorizationService = defaultAuthorizationService,
    private readonly auditService: AuditWriter = defaultAuditService,
    private readonly costService: CostSnapshotWriter = defaultCostService,
    private readonly eventWriter: FinancialEventWriter = financialEventService,
    private readonly cashWriter?: CashSourceWriter
  ) { }

  async createOrder(data: CreateCodOrderData) {
    return await db.transaction(async (tx) => {
      const quote = await codCheckoutService.buildQuote(data, tx);
      const payment = await paymentService.createPayment(
        {
          provider: "cod",
          status: "pending",
          amountPaise: quote.totalPaise,
          currency: "INR",
        },
        tx
      );

      const order = await codCheckoutService.createOrderSnapshot(
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

      await paymentRepository.createPaymentAttempt(
        {
          orderId: order.id,
          storeId: order.storeId,
          provider: "cod",
          method: "cash",
          status: "pending",
          amountPaise: quote.totalPaise,
          currency: "INR",
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

  async getOrders(userId: number, status?: OrderStatus, { page = 1, limit = ORDER_LIST_DEFAULT_LIMIT } = {}) {
    const orders = await db.query.ordersTable.findMany({
      where: status
        ? and(eq(ordersTable.status, status), eq(ordersTable.userId, userId))
        : eq(ordersTable.userId, userId),
      orderBy: [desc(ordersTable.orderDate), desc(ordersTable.id)],
      limit, offset: (page - 1) * limit,
      with: ORDER_SNAPSHOT_RELATIONS,
    });
    return orders.map(toOrderResponse);
  }

  async getAllUserOrders(userId: number, { page = 1, limit = ORDER_LIST_DEFAULT_LIMIT } = {}) {
    const orders = await db.query.ordersTable.findMany({
      where: eq(ordersTable.userId, userId),
      orderBy: [desc(ordersTable.orderDate), desc(ordersTable.id)],
      limit, offset: (page - 1) * limit,
      with: ORDER_SNAPSHOT_RELATIONS,
    });
    return orders.map(toOrderResponse);
  }

  async getOrderDetails(orderId: number) {
    const order = await db.query.ordersTable.findFirst({
      where: eq(ordersTable.id, orderId),
      with: {
        address: true,
        ...ORDER_SNAPSHOT_RELATIONS,
        payment: true,
        store: { columns: { id: true, name: true, slug: true } },
      },
    });
    return order ? toOrderResponse(order) : undefined;
  }

  async getAdminOrders({
    status = "pending",
    storeId,
    page = 1,
    limit = ORDER_LIST_DEFAULT_LIMIT,
  }: {
    status?: OrderStatus;
    storeId?: number;
    page?: number;
    limit?: number;
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
      orderBy: [desc(ordersTable.orderDate), desc(ordersTable.id)],
      limit, offset: (page - 1) * limit,
      with: {
        ...ORDER_SNAPSHOT_RELATIONS,
        user: { columns: { id: true, fname: true, lname: true, email: true } },
        store: { columns: { id: true, name: true, slug: true } },
      },
    });
    return orders.map(toOrderResponse);
  }

  async updateOrderStatus(
    orderId: number,
    status: OrderStatus,
    actor?: AuthPrincipal | number,
    now = new Date()
  ) {
    const transition = await this.updateOrderStatusWithTransition(
      orderId,
      status,
      actor,
      now
    );

    return transition.order;
  }

  async updateOrderStatusWithTransition(
    orderId: number,
    status: OrderStatus,
    actor?: AuthPrincipal | number,
    now = new Date()
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
        return {
          order,
          previousStatus: order.status,
          changed: false as const,
        };
      }

      assertValidOrderTransition(order.status, status);

      if (status === "cancelled") {
        if (order.pricingPolicyVersion === PRICING_POLICY_VERSION) {
          await new PromotionApplicationRepository().lockOwner(order.id, tx);
        }
        await inventoryService.restoreStockForOrder(
          {
            orderId: order.id,
            createdBy: principal?.userId ?? null,
          },
          tx
        );

        if (order.pricingPolicyVersion === PRICING_POLICY_VERSION) {
          await promotionApplicationService.release(order.id, tx, now);
        }
        if (order.couponId) {
          await checkoutService.releaseCouponReservation(order.id, tx);
        }
      }

      let capturedPaymentAttempt: { id: number; method: string | null } | null = null;
      if (status === "delivered" && order.paymentType === "cash") {
        if (!order.paymentId) {
          throw new AppError(
            "COD order has no linked payment",
            409,
            "COD_PAYMENT_NOT_FOUND"
          );
        }

        const paidAt = now;
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

        if (typeof tx?.update === "function") {
          const [capturedAttempt] = await tx
            .update(paymentAttemptsTable)
            .set({
              status: "captured",
              capturedAt: paidAt,
              updatedAt: paidAt,
            })
            .where(
              and(
                eq(paymentAttemptsTable.orderId, order.id),
                eq(paymentAttemptsTable.provider, "cod")
              )
            )
            .returning({ id: paymentAttemptsTable.id, method: paymentAttemptsTable.method });
          if (!capturedAttempt) {
            throw new AppError("COD payment attempt not found", 409, "PAYMENT_ATTEMPT_NOT_FOUND");
          }
          capturedPaymentAttempt = capturedAttempt;
        }
      }

      let costSnapshots: OrderCostSnapshot[] = [];
      let deliveryOccurredAt: Date | null = null;
      let cashSessionId: number | null = null;
      if (status === "delivered") {
        deliveryOccurredAt = order.deliveredAt ?? now;
        const deliveryBusinessDate = businessDateFor(deliveryOccurredAt, order.pricingTimezone);
        if (order.paymentType === "cash") {
          if (!this.cashWriter) throw new AppError("Cash source writer is unavailable", 500, "CASH_WRITER_UNAVAILABLE");
          const codCollection = await this.cashWriter.recordCodCollection(tx, {
            storeId: order.storeId,
            orderId: order.id,
            amountPaise: order.grandTotalPaise,
            occurredAt: deliveryOccurredAt,
            actorId: principal?.userId ?? null,
          });
          cashSessionId = codCollection.session.id;
          if (!capturedPaymentAttempt) throw new AppError("COD payment attempt not found", 409, "PAYMENT_ATTEMPT_NOT_FOUND");
          await this.eventWriter.write(tx, {
            eventType: "payment_attempt.captured",
            schemaVersion: 1,
            sourceType: "payment_attempt",
            sourceId: capturedPaymentAttempt.id,
            sourceVersion: 1,
            storeId: order.storeId,
            currency: order.currency,
            occurredAt: deliveryOccurredAt,
            businessDate: deliveryBusinessDate,
            timezone: order.pricingTimezone,
            actorId: principal?.userId ?? null,
            payload: {
              paymentAttemptId: capturedPaymentAttempt.id,
              orderId: order.id,
              provider: "cod",
              method: capturedPaymentAttempt.method ?? "cash",
              capturedPaise: order.grandTotalPaise,
              capturedAt: deliveryOccurredAt.toISOString(),
              cashSessionId,
            },
          });
        }
        costSnapshots = await this.costService.snapshotOrderItems(tx, {
          orderId: order.id,
          storeId: order.storeId,
          businessDate: deliveryBusinessDate,
        });
      }
      const orderUpdates: Partial<typeof ordersTable.$inferInsert> = {
        status,
        updatedAt: now,
      };

      if (status === "delivered") {
        orderUpdates.deliveredAt = deliveryOccurredAt;
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

      if (status === "delivered") {
        await this.eventWriter.write(tx, {
          eventType: "order.delivered",
          schemaVersion: 1,
          sourceType: "order",
          sourceId: order.id,
          sourceVersion: 1,
          storeId: order.storeId,
          currency: order.currency,
          occurredAt: deliveryOccurredAt!,
          businessDate: businessDateFor(deliveryOccurredAt!, order.pricingTimezone),
          timezone: order.pricingTimezone,
          actorId: principal?.userId ?? null,
          payload: buildDeliveredOrderPayload(order, costSnapshots, deliveryOccurredAt!),
        });
      }

      return {
        order: updatedOrder,
        previousStatus: order.status,
        changed: true as const,
      };
    });
  }
}

export { OrderService };
export default new OrderService(undefined, undefined, undefined, undefined, cashService);
