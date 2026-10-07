import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db";
import {
  orderItemsTable,
  ordersTable,
  paymentAttemptsTable,
  refundAllocationsTable,
  refundsTable,
  storesTable,
} from "../../db/schema";
import type { RefundStatus, TransactionType } from "../../utils/types";

export class RefundRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) {
    return db.transaction(work);
  }

  async findById(id: number) {
    const refund = (await db.select().from(refundsTable).where(eq(refundsTable.id, id)))[0];
    if (!refund) return undefined;
    return { refund, allocations: await db.select().from(refundAllocationsTable)
      .where(eq(refundAllocationsTable.refundId, id)).orderBy(asc(refundAllocationsTable.id)) };
  }

  async findByClientRequestId(clientRequestId: string) {
    const refund = (await db.select().from(refundsTable)
      .where(eq(refundsTable.clientRequestId, clientRequestId)))[0];
    if (!refund) return undefined;
    return { refund, allocations: await db.select().from(refundAllocationsTable)
      .where(eq(refundAllocationsTable.refundId, refund.id)).orderBy(asc(refundAllocationsTable.id)) };
  }

  async findByProviderRefundId(providerRefundId: string) {
    const refund = (await db.select().from(refundsTable)
      .where(eq(refundsTable.providerRefundId, providerRefundId)))[0];
    if (!refund) return undefined;
    return { refund, allocations: await db.select().from(refundAllocationsTable)
      .where(eq(refundAllocationsTable.refundId, refund.id)).orderBy(asc(refundAllocationsTable.id)) };
  }

  async getPaymentAttempt(id: number) {
    return (await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, id)))[0];
  }

  allocations(tx: TransactionType, refundId: number) {
    return tx.select().from(refundAllocationsTable).where(eq(refundAllocationsTable.refundId, refundId)).orderBy(asc(refundAllocationsTable.id));
  }

  async findStore(tx: TransactionType, storeId: number) {
    return (await tx.select({ id: storesTable.id, timezone: storesTable.timezone }).from(storesTable).where(eq(storesTable.id, storeId)))[0];
  }

  async lockOrder(tx: TransactionType, orderId: number) {
    return (await tx.select().from(ordersTable).where(eq(ordersTable.id, orderId))
      .for("update", { of: ordersTable }))[0];
  }

  async lockPaymentAttempts(tx: TransactionType, orderId: number) {
    return tx.select().from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.orderId, orderId))
      .orderBy(asc(paymentAttemptsTable.id)).for("update", { of: paymentAttemptsTable });
  }

  async lockRefund(tx: TransactionType, refundId: number) {
    return (await tx.select().from(refundsTable).where(eq(refundsTable.id, refundId))
      .for("update", { of: refundsTable }))[0];
  }

  listOrderItems(tx: TransactionType, orderId: number) {
    return tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId))
      .orderBy(asc(orderItemsTable.id));
  }

  listActiveAllocations(tx: TransactionType, orderId: number, statuses: RefundStatus[]) {
    return tx.select({
      kind: refundAllocationsTable.kind,
      orderItemId: refundAllocationsTable.orderItemId,
      quantity: refundAllocationsTable.quantity,
      amountPaise: refundAllocationsTable.amountPaise,
      taxPaise: refundAllocationsTable.taxPaise,
    }).from(refundAllocationsTable)
      .innerJoin(refundsTable, eq(refundsTable.id, refundAllocationsTable.refundId))
      .where(and(eq(refundsTable.orderId, orderId), inArray(refundsTable.status, statuses)));
  }

  listAttemptRefunds(tx: TransactionType, paymentAttemptId: number, statuses: RefundStatus[]) {
    return tx.select().from(refundsTable).where(and(
      eq(refundsTable.paymentAttemptId, paymentAttemptId),
      inArray(refundsTable.status, statuses)
    )).orderBy(asc(refundsTable.id)).for("update", { of: refundsTable });
  }

  async create(tx: TransactionType, data: typeof refundsTable.$inferInsert,
    allocations: Omit<typeof refundAllocationsTable.$inferInsert, "refundId" | "orderId">[]) {
    const refund = (await tx.insert(refundsTable).values(data).returning())[0];
    await tx.insert(refundAllocationsTable).values(allocations.map((allocation) => ({
      ...allocation, refundId: refund.id, orderId: refund.orderId,
    })));
    return refund;
  }

  async update(tx: TransactionType, id: number, data: Partial<typeof refundsTable.$inferInsert>) {
    return (await tx.update(refundsTable).set({ ...data, updatedAt: new Date() })
      .where(eq(refundsTable.id, id)).returning())[0];
  }

  async findStaleCandidates(cutoff: Date, limit: number, storeId?: number) {
    const conditions = [
      inArray(refundsTable.status, ["submitted", "processing"]),
      lt(refundsTable.updatedAt, cutoff),
    ];
    if (storeId !== undefined) {
      conditions.push(eq(refundsTable.storeId, storeId));
    }
    return db
      .select()
      .from(refundsTable)
      .where(and(...conditions))
      .orderBy(asc(refundsTable.updatedAt))
      .limit(limit);
  }

  async list(
    storeId: number,
    status: RefundStatus | undefined,
    page: number,
    limit: number,
    options?: { stuckCutoff?: Date }
  ) {
    const conditions = [eq(refundsTable.storeId, storeId)];
    if (status) {
      conditions.push(eq(refundsTable.status, status));
    }
    if (options?.stuckCutoff) {
      conditions.push(inArray(refundsTable.status, ["submitted", "processing"]));
      conditions.push(lt(refundsTable.updatedAt, options.stuckCutoff));
    }
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: count() }).from(refundsTable).where(where);
    const items = await db.select().from(refundsTable).where(where)
      .orderBy(desc(refundsTable.requestedAt), desc(refundsTable.id))
      .limit(limit).offset((page - 1) * limit);
    const parsedTotal = Number(total);
    return { items, meta: { total: parsedTotal, page, limit,
      totalPages: Math.ceil(parsedTotal / limit), hasNextPage: page * limit < parsedTotal } };
  }
}

export default new RefundRepository();
