import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { financialOutboxTable } from "../../db/schema";
import { db } from "../../db";
import type { TransactionType } from "../../utils/types";
import type { WriteFinancialEventInput } from "./financial-event.types";

export class FinancialEventRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) {
    return db.transaction(work);
  }
  async create(tx: TransactionType, values: WriteFinancialEventInput & { eventId: string; payloadHash: string }) {
    const insert = {
      ...values,
      sourceId: String(values.sourceId),
      actorId: values.actorId ?? null,
      correlationId: values.correlationId ?? null,
      causationId: values.causationId ?? null,
    };
    const created = (await tx.insert(financialOutboxTable).values(insert)
      .onConflictDoNothing({ target: [
        financialOutboxTable.sourceType,
        financialOutboxTable.sourceId,
        financialOutboxTable.eventType,
        financialOutboxTable.sourceVersion,
      ] }).returning())[0];
    if (created) return { event: created, created: true };
    const existing = (await tx.select().from(financialOutboxTable).where(and(
      eq(financialOutboxTable.sourceType, values.sourceType),
      eq(financialOutboxTable.sourceId, String(values.sourceId)),
      eq(financialOutboxTable.eventType, values.eventType),
      eq(financialOutboxTable.sourceVersion, values.sourceVersion)
    )))[0];
    return { event: existing, created: false };
  }

  async claim(
    tx: TransactionType,
    workerId: string,
    limit: number,
    maxAttempts: number,
    now: Date,
    staleBefore: Date
  ) {
    const rows = await tx.select({ id: financialOutboxTable.id }).from(financialOutboxTable)
      .where(and(
        or(
          eq(financialOutboxTable.status, "pending"),
          eq(financialOutboxTable.status, "failed"),
          and(eq(financialOutboxTable.status, "processing"), lte(financialOutboxTable.claimedAt, staleBefore))
        ),
        lte(financialOutboxTable.availableAt, now),
        lt(financialOutboxTable.attemptCount, maxAttempts)
      )).orderBy(asc(financialOutboxTable.availableAt), asc(financialOutboxTable.id))
      .limit(limit).for("update", { skipLocked: true });
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    await tx.update(financialOutboxTable).set({
      status: "processing",
      claimedAt: now,
      claimedBy: workerId,
      attemptCount: sql`${financialOutboxTable.attemptCount} + 1`,
      lastError: null,
      updatedAt: now,
    }).where(inArray(financialOutboxTable.id, ids));
    return tx.select().from(financialOutboxTable).where(inArray(financialOutboxTable.id, ids))
      .orderBy(asc(financialOutboxTable.id));
  }

  async markProcessed(tx: TransactionType, eventId: string, workerId: string, now: Date) {
    return (await tx.update(financialOutboxTable).set({
      status: "processed", processedAt: now, claimedAt: null, claimedBy: null, updatedAt: now,
    }).where(and(
      eq(financialOutboxTable.eventId, eventId),
      eq(financialOutboxTable.status, "processing"),
      eq(financialOutboxTable.claimedBy, workerId)
    )).returning())[0];
  }

  async markFailed(tx: TransactionType, input: {
    eventId: string; workerId: string; error: string; availableAt: Date; maxAttempts: number; now: Date;
  }) {
    return (await tx.update(financialOutboxTable).set({
      status: sql`case when ${financialOutboxTable.attemptCount} >= ${input.maxAttempts} then 'dead_letter' else 'failed' end`,
      lastError: input.error,
      availableAt: input.availableAt,
      claimedAt: null,
      claimedBy: null,
      updatedAt: input.now,
    }).where(and(
      eq(financialOutboxTable.eventId, input.eventId),
      eq(financialOutboxTable.status, "processing"),
      eq(financialOutboxTable.claimedBy, input.workerId)
    )).returning())[0];
  }
}

export default new FinancialEventRepository();
