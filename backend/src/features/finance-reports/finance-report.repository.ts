import { and, asc, count, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { journalEntriesTable, journalLinesTable, ledgerAccountsTable, reconciliationIssuesTable, storesTable } from "../../db/schema";
import type { FinanceMovement } from "./finance-report.policy";

const storeCondition = (storeIds: number[]): SQL => storeIds.length === 0
  ? sql`false`
  : storeIds.length === 1
    ? eq(journalEntriesTable.storeId, storeIds[0])
    : inArray(journalEntriesTable.storeId, storeIds);

export class FinanceReportRepository {
  async stores(storeId?: number) {
    return db.select({ id: storesTable.id, timezone: storesTable.timezone }).from(storesTable)
      .where(storeId === undefined ? undefined : eq(storesTable.id, storeId)).orderBy(asc(storesTable.id));
  }

  async movements(storeIds: number[], from: string, to: string): Promise<FinanceMovement[]> {
    return db.select({
      businessDate: journalEntriesTable.businessDate,
      accountCode: ledgerAccountsTable.code,
      accountName: ledgerAccountsTable.name,
      accountType: ledgerAccountsTable.type,
      debitPaise: sql<string>`coalesce(sum(${journalLinesTable.debitPaise})::text, '0')`,
      creditPaise: sql<string>`coalesce(sum(${journalLinesTable.creditPaise})::text, '0')`,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalLinesTable.journalEntryId))
      .innerJoin(ledgerAccountsTable, eq(ledgerAccountsTable.id, journalLinesTable.accountId))
      .where(and(
        storeCondition(storeIds),
        inArray(journalEntriesTable.status, ["posted", "reversed"]),
        eq(journalEntriesTable.currency, "INR"),
        gte(journalEntriesTable.businessDate, from),
        lte(journalEntriesTable.businessDate, to)
      )).groupBy(journalEntriesTable.businessDate, ledgerAccountsTable.id)
      .orderBy(asc(journalEntriesTable.businessDate), asc(ledgerAccountsTable.code));
  }

  async collectionTotal(storeIds: number[], from: string, to: string) {
    const original = alias(journalEntriesTable, "collection_original");
    const [row] = await db.select({
      totalPaise: sql<string>`coalesce(sum(${journalLinesTable.debitPaise}::bigint - ${journalLinesTable.creditPaise}::bigint)::text, '0')`,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalLinesTable.journalEntryId))
      .innerJoin(ledgerAccountsTable, eq(ledgerAccountsTable.id, journalLinesTable.accountId))
      .leftJoin(original, eq(original.id, journalEntriesTable.reversalOfJournalEntryId))
      .where(and(
        storeCondition(storeIds),
        inArray(journalEntriesTable.status, ["posted", "reversed"]),
        inArray(ledgerAccountsTable.code, ["1000", "1100"]),
        or(eq(journalEntriesTable.eventType, "payment.captured"), eq(original.eventType, "payment.captured")),
        gte(journalEntriesTable.businessDate, from),
        lte(journalEntriesTable.businessDate, to)
      ));
    return row.totalPaise;
  }

  async unsettledRazorpay(storeIds: number[], asOf: string) {
    const [row] = await db.select({
      totalPaise: sql<string>`coalesce(sum(${journalLinesTable.debitPaise}::bigint - ${journalLinesTable.creditPaise}::bigint)::text, '0')`,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalLinesTable.journalEntryId))
      .innerJoin(ledgerAccountsTable, eq(ledgerAccountsTable.id, journalLinesTable.accountId))
      .where(and(storeCondition(storeIds), inArray(journalEntriesTable.status, ["posted", "reversed"]), eq(ledgerAccountsTable.code, "1100"), lte(journalEntriesTable.businessDate, asOf)));
    return row.totalPaise;
  }

  async openReconciliationIssues(storeIds: number[]) {
    const scope = storeIds.length === 0 ? sql`false` : storeIds.length === 1
      ? eq(reconciliationIssuesTable.storeId, storeIds[0])
      : inArray(reconciliationIssuesTable.storeId, storeIds);
    const [row] = await db.select({ total: count() }).from(reconciliationIssuesTable)
      .where(and(scope, eq(reconciliationIssuesTable.status, "open")));
    return Number(row.total);
  }
}

export default new FinanceReportRepository();
