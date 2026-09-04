import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  reconciliationIssuesTable,
  paymentAttemptsTable,
  refundsTable,
  settlementBatchesTable,
  settlementLinesTable,
  storesTable,
} from "../../db/schema";
import type { SettlementBatchStatus, TransactionType } from "../../utils/types";
import type { SettlementImportBatch } from "./settlement.fixtures";
import { hashSettlementPayload } from "./settlement.policy";
import type { MatchingIssue, SettlementLineMatch } from "./settlement-matching";

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

  async findDetail(id: number, executor: typeof db | TransactionType = db) {
    const batch = (await executor.select().from(settlementBatchesTable)
      .where(eq(settlementBatchesTable.id, id)))[0];
    if (!batch) return undefined;
    const [lines, issues] = await Promise.all([
      executor.select().from(settlementLinesTable).where(eq(settlementLinesTable.batchId, id))
        .orderBy(asc(settlementLinesTable.occurredAt), asc(settlementLinesTable.id)),
      executor.select().from(reconciliationIssuesTable).where(eq(reconciliationIssuesTable.batchId, id))
        .orderBy(asc(reconciliationIssuesTable.id)),
    ]);
    return { batch, lines, issues };
  }

  async lockBatch(tx: TransactionType, id: number) {
    return (await tx.select().from(settlementBatchesTable)
      .where(eq(settlementBatchesTable.id, id)).for("update"))[0];
  }

  async listLocalCandidates(tx: TransactionType, batch: typeof settlementBatchesTable.$inferSelect) {
    const [paymentAttempts, refunds] = await Promise.all([
      tx.select({
        id: paymentAttemptsTable.id,
        providerPaymentId: paymentAttemptsTable.providerPaymentId,
        status: paymentAttemptsTable.status,
        amountPaise: paymentAttemptsTable.amountPaise,
        currency: paymentAttemptsTable.currency,
        capturedAt: paymentAttemptsTable.capturedAt,
      }).from(paymentAttemptsTable).where(and(
        eq(paymentAttemptsTable.storeId, batch.storeId),
        eq(paymentAttemptsTable.provider, "razorpay")
      )),
      tx.select({
        id: refundsTable.id,
        providerRefundId: refundsTable.providerRefundId,
        status: refundsTable.status,
        amountPaise: refundsTable.amountPaise,
        currency: refundsTable.currency,
        processedAt: refundsTable.processedAt,
      }).from(refundsTable).where(and(
        eq(refundsTable.storeId, batch.storeId)
      )),
    ]);
    const inPeriod = (value: Date | null) => Boolean(
      value && value >= batch.periodFrom && value <= batch.periodTo
    );
    return {
      paymentAttempts: paymentAttempts.map(({ capturedAt, ...item }) => ({
        ...item,
        expectedInProvider: item.status === "captured" && inPeriod(capturedAt),
      })),
      refunds: refunds.map(({ processedAt, ...item }) => ({
        ...item,
        expectedInProvider: item.status === "processed" && inPeriod(processedAt),
      })),
    };
  }

  async applyMatching(
    tx: TransactionType,
    batch: typeof settlementBatchesTable.$inferSelect,
    matches: SettlementLineMatch[],
    issues: MatchingIssue[],
    ownerUserId: number
  ) {
    for (const match of matches) {
      await tx.update(settlementLinesTable).set({
        matchStatus: match.matchStatus,
        paymentAttemptId: match.paymentAttemptId,
        refundId: match.refundId,
        updatedAt: new Date(),
      }).where(and(
        eq(settlementLinesTable.id, match.lineId),
        eq(settlementLinesTable.batchId, batch.id),
        eq(settlementLinesTable.storeId, batch.storeId)
      ));
    }
    if (issues.length > 0) {
      await tx.insert(reconciliationIssuesTable).values(issues.map((item) => ({
        storeId: batch.storeId,
        batchId: batch.id,
        settlementLineId: item.settlementLineId,
        paymentAttemptId: item.paymentAttemptId,
        refundId: item.refundId,
        issueType: item.issueType,
        severity: item.severity,
        ownerUserId,
        details: item.details,
      })));
    }
    const now = new Date();
    return (await tx.update(settlementBatchesTable).set({
      status: issues.length > 0 ? "needs_review" : "reconciled",
      reconciledAt: issues.length > 0 ? null : now,
      updatedAt: now,
    }).where(eq(settlementBatchesTable.id, batch.id)).returning())[0];
  }

  async findIssue(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(reconciliationIssuesTable)
      .where(eq(reconciliationIssuesTable.id, id)))[0];
  }

  async lockIssue(tx: TransactionType, id: number) {
    return (await tx.select().from(reconciliationIssuesTable)
      .where(eq(reconciliationIssuesTable.id, id)).for("update"))[0];
  }

  async resolveIssue(tx: TransactionType, id: number, actorId: number, reason: string) {
    const now = new Date();
    return (await tx.update(reconciliationIssuesTable).set({
      status: "resolved",
      resolutionNote: reason,
      resolvedBy: actorId,
      resolvedAt: now,
      updatedAt: now,
    }).where(eq(reconciliationIssuesTable.id, id)).returning())[0];
  }

  async markBatchReconciledWhenClear(tx: TransactionType, batchId: number) {
    const [{ total }] = await tx.select({ total: count() }).from(reconciliationIssuesTable)
      .where(and(eq(reconciliationIssuesTable.batchId, batchId), eq(reconciliationIssuesTable.status, "open")));
    if (Number(total) > 0) return false;
    await tx.update(settlementBatchesTable).set({
      status: "reconciled",
      reconciledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(settlementBatchesTable.id, batchId));
    return true;
  }

  async listIssues(storeId: number, status: "open" | "resolved" | undefined, page: number, limit: number) {
    const where = status
      ? and(eq(reconciliationIssuesTable.storeId, storeId), eq(reconciliationIssuesTable.status, status))
      : eq(reconciliationIssuesTable.storeId, storeId);
    const [{ total }] = await db.select({ total: count() }).from(reconciliationIssuesTable).where(where);
    const items = await db.select().from(reconciliationIssuesTable).where(where)
      .orderBy(desc(reconciliationIssuesTable.createdAt), desc(reconciliationIssuesTable.id))
      .limit(limit).offset((page - 1) * limit);
    const parsedTotal = Number(total);
    return { items, meta: { total: parsedTotal, page, limit,
      totalPages: Math.ceil(parsedTotal / limit), hasNextPage: page * limit < parsedTotal } };
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
