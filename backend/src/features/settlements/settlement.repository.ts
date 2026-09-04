import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  reconciliationIssuesTable,
  settlementBatchesTable,
  settlementLinesTable,
  storesTable,
} from "../../db/schema";
import type { SettlementBatchStatus, TransactionType } from "../../utils/types";
import type { SettlementImportBatch } from "./settlement.fixtures";
import { hashSettlementPayload } from "./settlement.policy";

export class SettlementRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) {
    return db.transaction(work);
  }

  async storeExists(storeId: number) {
    return Boolean((await db.select({ id: storesTable.id }).from(storesTable)
      .where(eq(storesTable.id, storeId)))[0]);
  }

  async findByProviderId(providerSettlementId: string, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(settlementBatchesTable)
      .where(eq(settlementBatchesTable.providerSettlementId, providerSettlementId)))[0];
  }

  async create(tx: TransactionType, batch: SettlementImportBatch, payloadHash: string, importedBy: number) {
    const created = (await tx.insert(settlementBatchesTable).values({
      storeId: batch.storeId,
      provider: "razorpay",
      providerSettlementId: batch.providerSettlementId,
      providerStatus: batch.providerStatus,
      status: "imported",
      source: batch.source,
      periodFrom: new Date(batch.periodFrom),
      periodTo: new Date(batch.periodTo),
      grossAmountPaise: batch.grossAmountPaise,
      feePaise: batch.feePaise,
      feeTaxPaise: batch.feeTaxPaise,
      adjustmentPaise: batch.adjustmentPaise,
      netAmountPaise: batch.netAmountPaise,
      currency: batch.currency,
      utr: batch.utr,
      providerReference: batch.providerReference,
      payloadHash,
      settledAt: new Date(batch.settledAt),
      importedBy,
    }).returning())[0];

    if (batch.lines.length > 0) {
      await tx.insert(settlementLinesTable).values(batch.lines.map((line) => ({
        batchId: created.id,
        storeId: created.storeId,
        providerLineId: line.providerLineId,
        providerTransactionId: line.providerTransactionId,
        providerEntityId: line.providerEntityId,
        type: line.type,
        providerStatus: line.providerStatus,
        amountPaise: line.amountPaise,
        feePaise: line.feePaise,
        feeTaxPaise: line.feeTaxPaise,
        currency: line.currency,
        occurredAt: new Date(line.occurredAt),
        matchStatus: "unmatched" as const,
        payloadHash: hashSettlementPayload(line),
      })));
    }
    return created;
  }

  async findDetail(id: number) {
    const batch = (await db.select().from(settlementBatchesTable)
      .where(eq(settlementBatchesTable.id, id)))[0];
    if (!batch) return undefined;
    const [lines, issues] = await Promise.all([
      db.select().from(settlementLinesTable).where(eq(settlementLinesTable.batchId, id))
        .orderBy(asc(settlementLinesTable.occurredAt), asc(settlementLinesTable.id)),
      db.select().from(reconciliationIssuesTable).where(eq(reconciliationIssuesTable.batchId, id))
        .orderBy(asc(reconciliationIssuesTable.id)),
    ]);
    return { batch, lines, issues };
  }

  async list(storeId: number, status: SettlementBatchStatus | undefined, page: number, limit: number) {
    const where = status
      ? and(eq(settlementBatchesTable.storeId, storeId), eq(settlementBatchesTable.status, status))
      : eq(settlementBatchesTable.storeId, storeId);
    const [{ total }] = await db.select({ total: count() }).from(settlementBatchesTable).where(where);
    const items = await db.select().from(settlementBatchesTable).where(where)
      .orderBy(desc(settlementBatchesTable.settledAt), desc(settlementBatchesTable.id))
      .limit(limit).offset((page - 1) * limit);
    const parsedTotal = Number(total);
    return {
      items,
      meta: {
        total: parsedTotal,
        page,
        limit,
        totalPages: Math.ceil(parsedTotal / limit),
        hasNextPage: page * limit < parsedTotal,
      },
    };
  }
}

export default new SettlementRepository();
