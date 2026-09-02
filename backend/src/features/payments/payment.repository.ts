import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  ordersTable,
  paymentsTable,
  paymentAttemptsTable,
  storesTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type {
  LocalRazorpayAttempt,
  PaymentAttemptDTO,
} from "./payment.types";

class PaymentRepository {
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

  async getAttemptByClientRequestId(clientRequestId: string) {
    const [attempt] = await this.selectAttempts()
      .where(eq(paymentsTable.clientRequestId, clientRequestId))
      .limit(1);
    return attempt;
  }

  async getAttemptByOrderId(localOrderId: number) {
    const [attempt] = await this.selectAttempts()
      .where(eq(ordersTable.id, localOrderId))
      .limit(1);
    return attempt;
  }

  async getAttemptByProviderOrderId(providerOrderId: string) {
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
        couponId: ordersTable.couponId,
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
    return attempt;
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
      userId: number;
      grandTotalPaise: number | null;
      couponId: number | null;
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
      localPaymentId: attempt.id,
      userId: order.userId,
      storeId: store.id,
      storeName: store.name,
      grandTotalPaise: order.grandTotalPaise,
      couponId: order.couponId,
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
