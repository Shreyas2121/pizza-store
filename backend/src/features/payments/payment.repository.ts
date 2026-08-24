import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  ordersTable,
  paymentsTable,
  storesTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";

class PaymentRepository {
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
        totalPrice: ordersTable.totalPrice,
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
}

export { PaymentRepository };
export default new PaymentRepository();
