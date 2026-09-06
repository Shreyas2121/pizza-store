import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../../db";
import {
  fiscalPeriodsTable,
  journalEntriesTable,
  journalLinesTable,
  ledgerAccountsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { PostingCommand } from "./ledger.types";

type Account = typeof ledgerAccountsTable.$inferSelect;

export class LedgerRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) {
    return db.transaction(work);
  }

  findBySource(tx: TransactionType, source: PostingCommand["source"]) {
    return tx.query.journalEntriesTable.findFirst({ where: and(
      eq(journalEntriesTable.sourceType, source.sourceType),
      eq(journalEntriesTable.sourceId, String(source.sourceId)),
      eq(journalEntriesTable.eventType, source.eventType),
      eq(journalEntriesTable.sourceVersion, source.sourceVersion)
    ), with: { lines: true } });
  }

  async findPeriodForUpdate(tx: TransactionType, storeId: number, businessDate: string) {
    return tx.select().from(fiscalPeriodsTable).where(and(
      eq(fiscalPeriodsTable.storeId, storeId),
      lte(fiscalPeriodsTable.startDate, businessDate),
      gte(fiscalPeriodsTable.endDate, businessDate)
    )).orderBy(fiscalPeriodsTable.id).limit(2).for("update");
  }

  findAccounts(tx: TransactionType, codes: string[]) {
    return tx.select().from(ledgerAccountsTable).where(inArray(ledgerAccountsTable.code, codes));
  }

  async createPosted(
    tx: TransactionType,
    command: PostingCommand,
    commandHash: string,
    accounts: Map<string, Account>,
    reversalOfJournalEntryId?: number,
    reversalReason?: string
  ) {
    const now = new Date();
    const draft = (await tx.insert(journalEntriesTable).values({
      storeId: command.storeId,
      journalNumber: `JRN-${command.storeId}-${crypto.randomUUID()}`,
      businessDate: command.businessDate,
      occurredAt: command.occurredAt,
      description: command.description,
      currency: command.currency,
      sourceType: command.source.sourceType,
      sourceId: String(command.source.sourceId),
      eventType: command.source.eventType,
      sourceVersion: command.source.sourceVersion,
      commandHash,
      status: "draft",
      postedBy: command.postedBy ?? null,
      postedAt: null,
      reversalOfJournalEntryId: reversalOfJournalEntryId ?? null,
      reversalReason: reversalReason ?? null,
      updatedAt: now,
    }).returning())[0];

    await tx.insert(journalLinesTable).values(command.lines.map((line, index) => ({
      journalEntryId: draft.id,
      lineNumber: index + 1,
      accountId: accounts.get(line.accountCode)!.id,
      debitPaise: line.side === "debit" ? line.amountPaise : 0,
      creditPaise: line.side === "credit" ? line.amountPaise : 0,
      description: line.description ?? null,
      orderId: line.orderId ?? null,
      paymentAttemptId: line.paymentAttemptId ?? null,
      refundId: line.refundId ?? null,
      expenseId: line.expenseId ?? null,
      payRunId: line.payRunId ?? null,
      dimensions: line.metadata ?? {},
    })));
    const entry = (await tx.update(journalEntriesTable).set({
      status: "posted",
      postedAt: now,
      updatedAt: now,
    }).where(eq(journalEntriesTable.id, draft.id)).returning())[0];
    return { ...entry, lines: command.lines };
  }

  async findEntryForUpdate(tx: TransactionType, journalEntryId: number, storeId: number) {
    const locked = await tx.select({ id: journalEntriesTable.id }).from(journalEntriesTable).where(and(
      eq(journalEntriesTable.id, journalEntryId), eq(journalEntriesTable.storeId, storeId)
    )).limit(1).for("update");
    if (!locked.length) return undefined;
    return tx.query.journalEntriesTable.findFirst({
      where: and(eq(journalEntriesTable.id, journalEntryId), eq(journalEntriesTable.storeId, storeId)),
      with: { lines: { with: { account: true }, orderBy: journalLinesTable.lineNumber } },
    });
  }

  markReversed(tx: TransactionType, journalEntryId: number, now: Date) {
    return tx.update(journalEntriesTable).set({ status: "reversed", updatedAt: now })
      .where(and(eq(journalEntriesTable.id, journalEntryId), eq(journalEntriesTable.status, "posted")));
  }
}

export default new LedgerRepository();
