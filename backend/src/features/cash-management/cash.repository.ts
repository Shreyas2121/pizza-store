import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { cashMovementsTable, cashSessionClosuresTable, cashSessionsTable, storesTable } from "../../db/schema";
import type { CashSessionStatus, TransactionType } from "../../utils/types";
import type { CashSessionsQuery } from "./cash.schemas";

export class CashRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }

  async findStore(storeId: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: storesTable.id, timezone: storesTable.timezone }).from(storesTable).where(eq(storesTable.id, storeId)))[0];
  }

  async findById(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(cashSessionsTable).where(eq(cashSessionsTable.id, id)))[0];
  }

  async findByStoreDate(storeId: number, businessDate: string, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(cashSessionsTable).where(and(eq(cashSessionsTable.storeId, storeId), eq(cashSessionsTable.businessDate, businessDate))))[0];
  }

  async lockById(tx: TransactionType, id: number) {
    return (await tx.select().from(cashSessionsTable).where(eq(cashSessionsTable.id, id)).for("update"))[0];
  }

  async lockByStoreDate(tx: TransactionType, storeId: number, businessDate: string) {
    return (await tx.select().from(cashSessionsTable).where(and(eq(cashSessionsTable.storeId, storeId), eq(cashSessionsTable.businessDate, businessDate))).for("update"))[0];
  }

  async create(tx: TransactionType, input: { storeId: number; businessDate: string; openingFloatPaise: number; actorId: number; now: Date }) {
    return (await tx.insert(cashSessionsTable).values({
      storeId: input.storeId, businessDate: input.businessDate, openingFloatPaise: input.openingFloatPaise,
      expectedCashPaise: input.openingFloatPaise, openedBy: input.actorId, openedAt: input.now,
    }).returning())[0];
  }

  async addMovement(tx: TransactionType, input: typeof cashMovementsTable.$inferInsert) {
    return (await tx.insert(cashMovementsTable).values(input).returning())[0];
  }

  async updateExpected(tx: TransactionType, sessionId: number, expectedCashPaise: number, version: number) {
    return (await tx.update(cashSessionsTable).set({ expectedCashPaise, version, updatedAt: new Date() }).where(eq(cashSessionsTable.id, sessionId)).returning())[0];
  }

  async close(tx: TransactionType, session: typeof cashSessionsTable.$inferSelect, countedCashPaise: number, acknowledged: boolean, actorId: number, now: Date) {
    const variancePaise = countedCashPaise - session.expectedCashPaise;
    const version = session.version + 1;
    const updated = (await tx.update(cashSessionsTable).set({ status: "closed", countedCashPaise, variancePaise, materialVarianceAcknowledged: acknowledged, closedBy: actorId, closedAt: now, version, updatedAt: now }).where(eq(cashSessionsTable.id, session.id)).returning())[0];
    const closure = (await tx.insert(cashSessionClosuresTable).values({ sessionId: session.id, storeId: session.storeId, sessionVersion: version, expectedCashPaise: session.expectedCashPaise, countedCashPaise, variancePaise, materialVarianceAcknowledged: acknowledged, closedBy: actorId, closedAt: now }).returning())[0];
    return { session: updated, closure };
  }

  async activeClosure(tx: TransactionType, sessionId: number, sessionVersion: number) {
    return (await tx.select().from(cashSessionClosuresTable).where(and(eq(cashSessionClosuresTable.sessionId, sessionId), eq(cashSessionClosuresTable.sessionVersion, sessionVersion))).for("update"))[0];
  }

  async reopen(tx: TransactionType, session: typeof cashSessionsTable.$inferSelect, closureId: number, actorId: number, reason: string, now: Date) {
    await tx.update(cashSessionClosuresTable).set({ reversedBy: actorId, reversedAt: now, reversalReason: reason }).where(eq(cashSessionClosuresTable.id, closureId));
    return (await tx.update(cashSessionsTable).set({ status: "open", countedCashPaise: null, variancePaise: null, materialVarianceAcknowledged: false, closedBy: null, closedAt: null, version: session.version + 1, updatedAt: now }).where(eq(cashSessionsTable.id, session.id)).returning())[0];
  }

  async movement(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(cashMovementsTable).where(eq(cashMovementsTable.id, id)))[0];
  }

  async movements(sessionId: number, executor: typeof db | TransactionType = db) {
    return executor.select().from(cashMovementsTable).where(eq(cashMovementsTable.sessionId, sessionId)).orderBy(asc(cashMovementsTable.occurredAt), asc(cashMovementsTable.id));
  }

  async closures(sessionId: number, executor: typeof db | TransactionType = db) {
    return executor.select().from(cashSessionClosuresTable).where(eq(cashSessionClosuresTable.sessionId, sessionId)).orderBy(desc(cashSessionClosuresTable.closedAt));
  }

  async detail(id: number, executor: typeof db | TransactionType = db) {
    const session = await this.findById(id, executor);
    if (!session) return undefined;
    const [movements, closures] = await Promise.all([this.movements(id, executor), this.closures(id, executor)]);
    return { session, movements, closures };
  }

  async list(query: CashSessionsQuery) {
    const conditions = [eq(cashSessionsTable.storeId, query.storeId)];
    if (query.status) conditions.push(eq(cashSessionsTable.status, query.status as CashSessionStatus));
    if (query.businessDate) conditions.push(eq(cashSessionsTable.businessDate, query.businessDate));
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: count() }).from(cashSessionsTable).where(where);
    const items = await db.select().from(cashSessionsTable).where(where).orderBy(desc(cashSessionsTable.businessDate), desc(cashSessionsTable.id)).limit(query.limit).offset((query.page - 1) * query.limit);
    const parsedTotal = Number(total);
    return { items, meta: { total: parsedTotal, page: query.page, limit: query.limit, totalPages: Math.ceil(parsedTotal / query.limit), hasNextPage: query.page * query.limit < parsedTotal } };
  }
}

export default new CashRepository();
