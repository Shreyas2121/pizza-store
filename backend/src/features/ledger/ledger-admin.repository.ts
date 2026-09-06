import { and, asc, desc, eq, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { fiscalPeriodsTable, journalEntriesTable, journalLinesTable, ledgerAccountsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { JournalsQuery, TrialBalanceQuery } from "./ledger.schemas";

export class LedgerAdminRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }
  listAccounts() { return db.select().from(ledgerAccountsTable).orderBy(asc(ledgerAccountsTable.code)); }
  listPeriods(storeId: number) { return db.select().from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.storeId, storeId)).orderBy(desc(fiscalPeriodsTable.startDate), desc(fiscalPeriodsTable.id)); }
  async findPeriod(id: number) { return (await db.select().from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.id, id)))[0]; }
  async lockPeriod(tx: TransactionType, id: number) { return (await tx.select().from(fiscalPeriodsTable).where(eq(fiscalPeriodsTable.id, id)).for("update"))[0]; }
  overlappingPeriods(tx: TransactionType, storeId: number, startDate: string, endDate: string) { return tx.select({ id: fiscalPeriodsTable.id }).from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.storeId, storeId), lte(fiscalPeriodsTable.startDate, endDate), gte(fiscalPeriodsTable.endDate, startDate))).limit(1).for("update"); }
  async createPeriod(tx: TransactionType, input: { storeId: number; name: string; startDate: string; endDate: string }) { return (await tx.insert(fiscalPeriodsTable).values(input).returning())[0]; }
  async updatePeriod(tx: TransactionType, id: number, values: Partial<typeof fiscalPeriodsTable.$inferInsert>) { return (await tx.update(fiscalPeriodsTable).set({ ...values, updatedAt: new Date() }).where(eq(fiscalPeriodsTable.id, id)).returning())[0]; }

  async listJournals(query: JournalsQuery) {
    const conditions: SQL[] = [inArray(journalEntriesTable.status, ["posted", "reversed"])];
    if (query.storeId) conditions.push(eq(journalEntriesTable.storeId, query.storeId));
    if (query.from) conditions.push(gte(journalEntriesTable.businessDate, query.from));
    if (query.to) conditions.push(lte(journalEntriesTable.businessDate, query.to));
    if (query.cursor) conditions.push(lt(journalEntriesTable.id, query.cursor));
    if (query.accountId) conditions.push(sql`exists (select 1 from ${journalLinesTable} jl where jl.journal_entry_id = ${journalEntriesTable.id} and jl.account_id = ${query.accountId})`);
    if (query.eventType) conditions.push(eq(journalEntriesTable.eventType, query.eventType));
    if (query.sourceType) conditions.push(eq(journalEntriesTable.sourceType, query.sourceType));
    if (query.sourceId) conditions.push(eq(journalEntriesTable.sourceId, query.sourceId));
    if (query.accountCodes || query.excludeAccountCodes || query.accountTypes) {
      const lineConditions: SQL[] = [sql`jl.journal_entry_id = ${journalEntriesTable.id}`];
      if (query.accountCodes) lineConditions.push(sql`la.code in (${sql.join(query.accountCodes.map((code) => sql`${code}`), sql`, `)})`);
      if (query.excludeAccountCodes) lineConditions.push(sql`la.code not in (${sql.join(query.excludeAccountCodes.map((code) => sql`${code}`), sql`, `)})`);
      if (query.accountTypes) lineConditions.push(sql`la.type in (${sql.join(query.accountTypes.map((type) => sql`${type}`), sql`, `)})`);
      conditions.push(sql`exists (select 1 from ${journalLinesTable} jl inner join ${ledgerAccountsTable} la on la.id = jl.account_id where ${and(...lineConditions)})`);
    }
    const rows = await db.select().from(journalEntriesTable).where(and(...conditions)).orderBy(desc(journalEntriesTable.id)).limit(query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return { items, meta: { limit: query.limit, hasNextPage, nextCursor: hasNextPage ? items.at(-1)!.id : null } };
  }

  async journalDetail(id: number) {
    return db.query.journalEntriesTable.findFirst({ where: eq(journalEntriesTable.id, id), with: { lines: { with: { account: true }, orderBy: journalLinesTable.lineNumber } } });
  }

  async trialBalance(query: TrialBalanceQuery) {
    const conditions: SQL[] = [eq(journalEntriesTable.storeId, query.storeId), inArray(journalEntriesTable.status, ["posted", "reversed"]), eq(journalEntriesTable.currency, "INR")];
    if (query.from) conditions.push(gte(journalEntriesTable.businessDate, query.from));
    if (query.to) conditions.push(lte(journalEntriesTable.businessDate, query.to));
    return db.select({
      accountId: ledgerAccountsTable.id,
      accountCode: ledgerAccountsTable.code,
      accountName: ledgerAccountsTable.name,
      accountType: ledgerAccountsTable.type,
      normalSide: ledgerAccountsTable.normalSide,
      debitPaise: sql<string>`coalesce(sum(${journalLinesTable.debitPaise})::text, '0')`,
      creditPaise: sql<string>`coalesce(sum(${journalLinesTable.creditPaise})::text, '0')`,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalLinesTable.journalEntryId))
      .innerJoin(ledgerAccountsTable, eq(ledgerAccountsTable.id, journalLinesTable.accountId))
      .where(and(...conditions)).groupBy(ledgerAccountsTable.id).orderBy(asc(ledgerAccountsTable.code));
  }
}

export default new LedgerAdminRepository();
