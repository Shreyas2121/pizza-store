import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  ordersTable,
  paymentsTable,
  paymentAttemptsTable,
  storesTable,
  usersTable,
  promotionApplicationsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import type { TransactionType } from "../../utils/types";
import type {
  LocalRazorpayAttempt,
  PaymentAttemptDTO,
  PaymentPromotionSnapshot,
} from "./payment.types";

class PaymentRepository {
  // Existing-order lifecycle: order -> user -> store -> payment -> inventory ->
  // promotion definitions/settings -> applications. Compatible with cancellation.
  async lockLifecycleOwner(orderId: number, tx: TransactionType) {
    const [order] = await tx.select().from(ordersTable)
      .where(eq(ordersTable.id, orderId)).for("update").limit(1);
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    await tx.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.id, order.userId)).for("update");
    await tx.select({ id: storesTable.id }).from(storesTable)
      .where(eq(storesTable.id, order.storeId)).for("update");
    return order.status;
  }

  private promotionSnapshots() {
    return sql<PaymentPromotionSnapshot[]>`coalesce((select jsonb_agg(jsonb_build_object(
      'id', ${promotionApplicationsTable.promotionId},
      'kind', ${promotionApplicationsTable.promotionKind},
      'name', ${promotionApplicationsTable.promotionName},
      'code', ${promotionApplicationsTable.promotionCode},
      'discountType', ${promotionApplicationsTable.discountType},
      'definitionVersion', ${promotionApplicationsTable.definitionVersion},
      'itemDiscountPaise', ${promotionApplicationsTable.itemDiscountPaise},
      'deliveryDiscountPaise', ${promotionApplicationsTable.deliveryDiscountPaise},
      'totalSavingsPaise', ${promotionApplicationsTable.totalSavingsPaise}
    ) order by ${promotionApplicationsTable.promotionId}) from ${promotionApplicationsTable}
      where ${promotionApplicationsTable.orderId} = ${ordersTable.id}), '[]'::jsonb)`;
  }

  expiredAwaitingQuery(limit: number, now: Date) {
    return db.select({ orderId: ordersTable.id }).from(ordersTable)
      .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
      .where(and(eq(ordersTable.status, "awaiting_payment"), eq(paymentsTable.provider, "razorpay"),
        inArray(paymentsTable.status, ["pending", "processing", "failed"]),
        sql`exists (select 1 from ${paymentAttemptsTable}
          where ${paymentAttemptsTable.orderId} = ${ordersTable.id}
            and ${paymentAttemptsTable.provider} = 'razorpay'
            and ${paymentAttemptsTable.expiresAt} < ${now})`))
      .orderBy(ordersTable.id).limit(limit);
  }

  async getExpiredAwaitingOrderIds(limit: number, now = new Date()) {
    const rows = await this.expiredAwaitingQuery(limit, now);
    return rows.map((row) => row.orderId);
  }
  // ──────────────────────────────────────────────
  // Legacy Payments (Single Payment Compatibility)
  // ──────────────────────────────────────────────

  async createPayment(
    data: typeof paymentsTable.$inferInsert,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    const [payment] = await executor
      .insert(paymentsTable)
      .values(data)
      .returning();
    return payment;
  }

  async updatePayment(
    data: Partial<typeof paymentsTable.$inferInsert>,
    id: number,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    await executor.update(paymentsTable).set(data).where(eq(paymentsTable.id, id));
  }

  async getAttemptByClientRequestId(clientRequestId: string): Promise<LocalRazorpayAttempt | undefined> {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.clientRequestId, clientRequestId))
      .limit(1);
    return attempt;
  }

  async getAttemptByOrderId(localOrderId: number): Promise<LocalRazorpayAttempt | undefined> {
    const [attempt] = await this.selectAttempts()
      .where(eq(ordersTable.id, localOrderId))
      .limit(1);
    return attempt;
  }

  async getAttemptByProviderOrderId(providerOrderId: string): Promise<LocalRazorpayAttempt | undefined> {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.providerOrderId, providerOrderId))
      .limit(1);
    return attempt;
  }

  selectAttempts() {
    return db
      .select({
        localOrderId: ordersTable.id,
        localPaymentId: paymentsTable.id,
        userId: ordersTable.userId,
        storeId: ordersTable.storeId,
        storeName: storesTable.name,
        grandTotalPaise: ordersTable.grandTotalPaise,
        discountMode: ordersTable.discountMode,
        orderStatus: ordersTable.status,
        promotions: this.promotionSnapshots(),
        provider: paymentsTable.provider,
        amountPaise: paymentsTable.amountPaise,
        currency: paymentsTable.currency,
        status: paymentsTable.status,
        providerStatus: paymentsTable.providerStatus,
        providerOrderId: paymentsTable.providerOrderId,
        failureCode: paymentsTable.failureCode,
        failureDescription: paymentsTable.failureDescription,
      })
      .from(ordersTable)
      .innerJoin(paymentsTable, eq(ordersTable.paymentId, paymentsTable.id))
      .innerJoin(storesTable, eq(ordersTable.storeId, storesTable.id))
      .$dynamic();
  }

  paymentFields(payment: typeof paymentsTable.$inferSelect) {
    return {
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      status: payment.status,
      providerStatus: payment.providerStatus,
      providerOrderId: payment.providerOrderId,
      failureCode: payment.failureCode,
      failureDescription: payment.failureDescription,
    };
  }

  // ──────────────────────────────────────────────
  // Payment Attempts (Order-to-Many Aggregate)
  // ──────────────────────────────────────────────

  async createPaymentAttempt(
    data: typeof paymentAttemptsTable.$inferInsert,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    const [attempt] = await executor
      .insert(paymentAttemptsTable)
      .values(data)
      .returning();
    return attempt;
  }

  async updatePaymentAttempt(
    data: Partial<typeof paymentAttemptsTable.$inferInsert>,
    id: number,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    const [attempt] = await executor
      .update(paymentAttemptsTable)
      .set(data)
      .where(eq(paymentAttemptsTable.id, id))
      .returning();
    return attempt ?? null;
  }

  async getPaymentAttemptById(id: number, tx?: TransactionType) {
    const executor = tx ?? db;
    const [attempt] = await executor
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, id))
      .limit(1);
    return attempt ? this.toAttemptDTO(attempt) : undefined;
  }

  async getPaymentAttemptsByOrderId(orderId: number, tx?: TransactionType) {
    const executor = tx ?? db;
    const attempts = await executor
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.orderId, orderId))
      .orderBy(desc(paymentAttemptsTable.createdAt));
    return attempts.map((a) => this.toAttemptDTO(a));
  }

  async getAttemptsByOrderId(orderId: number, tx?: TransactionType) {
    return this.getPaymentAttemptsByOrderId(orderId, tx);
  }

  async getPaymentAttemptByClientRequestId(
    clientRequestId: string,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    const [attempt] = await executor
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.clientRequestId, clientRequestId))
      .limit(1);
    return attempt ? this.toAttemptDTO(attempt) : undefined;
  }

  async getPaymentAttemptByProviderOrderId(
    providerOrderId: string,
    tx?: TransactionType
  ) {
    const executor = tx ?? db;
    const [attempt] = await executor
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.providerOrderId, providerOrderId))
      .limit(1);
    return attempt ? this.toAttemptDTO(attempt) : undefined;
  }

  selectPaymentAttempts(tx?: TransactionType) {
    const executor = tx ?? db;
    return executor
      .select({
        attempt: paymentAttemptsTable,
        order: ordersTable,
        store: storesTable,
      })
      .from(paymentAttemptsTable)
      .innerJoin(ordersTable, eq(paymentAttemptsTable.orderId, ordersTable.id))
      .innerJoin(storesTable, eq(paymentAttemptsTable.storeId, storesTable.id))
      .$dynamic();
  }

  toAttemptDTO(attempt: typeof paymentAttemptsTable.$inferSelect): PaymentAttemptDTO {
    return {
      id: attempt.id,
      orderId: attempt.orderId,
      storeId: attempt.storeId,
      provider: attempt.provider,
      method: attempt.method,
      status: attempt.status,
      providerStatus: attempt.providerStatus,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      providerOrderId: attempt.providerOrderId,
      providerPaymentId: attempt.providerPaymentId,
      clientRequestId: attempt.clientRequestId,
      failureCode: attempt.failureCode,
      failureDescription: attempt.failureDescription,
      authorizedAt: attempt.authorizedAt,
      capturedAt: attempt.capturedAt,
      failedAt: attempt.failedAt,
      expiresAt: attempt.expiresAt,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  toLocalRazorpayAttempt(
    attempt: typeof paymentAttemptsTable.$inferSelect,
    order: {
      id: number;
      paymentId: number;
      userId: number;
      grandTotalPaise: number;
      discountMode: LocalRazorpayAttempt["discountMode"];
      orderStatus: LocalRazorpayAttempt["orderStatus"];
      promotions: PaymentPromotionSnapshot[];
    },
    store: { id: number; name: string }
  ): LocalRazorpayAttempt {
    const mappedStatus =
      attempt.status === "captured"
        ? "completed"
        : attempt.status === "failed" || attempt.status === "cancelled" || attempt.status === "expired" || attempt.status === "voided"
          ? "failed"
          : attempt.status === "processing" || attempt.status === "authorized"
            ? "processing"
            : "pending";

    return {
      localOrderId: order.id,
      localPaymentId: order.paymentId,
      userId: order.userId,
      storeId: store.id,
      storeName: store.name,
      grandTotalPaise: order.grandTotalPaise,
      discountMode: order.discountMode,
      orderStatus: order.orderStatus,
      promotions: order.promotions,
      provider: attempt.provider,
      amountPaise: attempt.amountPaise,
      currency: attempt.currency,
      status: mappedStatus,
      providerStatus: attempt.providerStatus,
      providerOrderId: attempt.providerOrderId,
      failureCode: attempt.failureCode,
      failureDescription: attempt.failureDescription,
    };
  }
}

export { PaymentRepository };
export default new PaymentRepository();
