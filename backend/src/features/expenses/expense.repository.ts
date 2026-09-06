import { and, asc, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import { expenseAllocationsTable, expenseAttachmentsTable, expenseCategoriesTable, expenseCommandsTable, expensesTable, orderItemsTable, ordersTable, storesTable, vendorsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { ExpenseCommandAction, ExpensesQueryInput, ExpenseWriteInput, SourceMarginQueryInput } from "./expense.schemas";
import { parseAggregatePaise } from "../../utils/money";
import { AppError } from "../../utils/error";

const safeAggregate = (value: string, label: string) => {
  const amount = Number(parseAggregatePaise(value));
  if (!Number.isSafeInteger(amount)) throw new AppError(`${label} exceeds the safe API response range.`, 500, "FINANCE_TOTAL_OUT_OF_RANGE");
  return amount;
};

export class ExpenseRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }
  async findStore(id: number, executor: typeof db | TransactionType = db) { return (await executor.select({ id: storesTable.id, timezone: storesTable.timezone }).from(storesTable).where(eq(storesTable.id, id)))[0]; }
  async findVendor(id: number, executor: typeof db | TransactionType = db) { return (await executor.select().from(vendorsTable).where(eq(vendorsTable.id, id)))[0]; }
  async findCategory(id: number, executor: typeof db | TransactionType = db) { return (await executor.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id)))[0]; }
  async findExpense(id: number, executor: typeof db | TransactionType = db) { return (await executor.select().from(expensesTable).where(eq(expensesTable.id, id)))[0]; }
  async lockExpense(tx: TransactionType, id: number) { return (await tx.select().from(expensesTable).where(eq(expensesTable.id, id)).for("update"))[0]; }
  async allocations(id: number, executor: typeof db | TransactionType = db) { return executor.select().from(expenseAllocationsTable).where(eq(expenseAllocationsTable.expenseId, id)).orderBy(asc(expenseAllocationsTable.id)); }
  async detail(id: number, executor: typeof db | TransactionType = db) { const expense = await this.findExpense(id, executor); return expense ? { expense, allocations: await this.allocations(id, executor) } : undefined; }
  async findByClientRequestId(key: string) { const expense = (await db.select().from(expensesTable).where(eq(expensesTable.clientRequestId, key)))[0]; return expense ? { expense, allocations: await this.allocations(expense.id) } : undefined; }
  async command(key: string, executor: typeof db | TransactionType = db) { return (await executor.select().from(expenseCommandsTable).where(eq(expenseCommandsTable.idempotencyKey, key)))[0]; }
  async attachments(expenseId: number, executor: typeof db | TransactionType = db) { return executor.select().from(expenseAttachmentsTable).where(eq(expenseAttachmentsTable.expenseId, expenseId)).orderBy(desc(expenseAttachmentsTable.id)); }
  async attachment(expenseId: number, attachmentId: number, executor: typeof db | TransactionType = db) { return (await executor.select().from(expenseAttachmentsTable).where(and(eq(expenseAttachmentsTable.id, attachmentId), eq(expenseAttachmentsTable.expenseId, expenseId))))[0]; }
  async createAttachment(tx: TransactionType, input: { expenseId: number; expenseStoreId: number; storageKey: string; originalName: string; mediaType: string; sizeBytes: number; sha256: string; uploadedBy: number }) { return (await tx.insert(expenseAttachmentsTable).values(input).returning())[0]; }

  async create(tx: TransactionType, input: ExpenseWriteInput, values: { clientRequestId: string; payloadHash: string; actorId: number; vendorName: string | null; allocations: Array<{ storeId: number; categoryId: number; categoryName: string; categoryClassification: "fixed" | "variable"; ledgerAccountId: number | null; costCenter: string | null; amountPaise: number }> }) {
    const expense = (await tx.insert(expensesTable).values({ storeId: input.storeId, vendorId: input.vendorId ?? null, vendorName: values.vendorName, expenseDate: input.expenseDate, description: input.description, subtotalPaise: input.subtotalPaise, taxPaise: input.taxPaise, totalPaise: input.totalPaise, clientRequestId: values.clientRequestId, payloadHash: values.payloadHash, createdBy: values.actorId, updatedBy: values.actorId }).returning())[0];
    await tx.insert(expenseAllocationsTable).values(values.allocations.map((item) => ({ ...item, expenseId: expense.id, expenseStoreId: expense.storeId })));
    return expense;
  }
  async update(tx: TransactionType, id: number, values: Partial<typeof expensesTable.$inferInsert>) { return (await tx.update(expensesTable).set({ ...values, updatedAt: new Date() }).where(eq(expensesTable.id, id)).returning())[0]; }
  async replaceAllocations(tx: TransactionType, expenseId: number, expenseStoreId: number, values: Array<{ storeId: number; categoryId: number; categoryName: string; categoryClassification: "fixed" | "variable"; ledgerAccountId: number | null; costCenter: string | null; amountPaise: number }>) { await tx.delete(expenseAllocationsTable).where(eq(expenseAllocationsTable.expenseId, expenseId)); await tx.insert(expenseAllocationsTable).values(values.map((item) => ({ ...item, expenseId, expenseStoreId }))); }
  async recordCommand(tx: TransactionType, values: { expenseId: number; action: ExpenseCommandAction; idempotencyKey: string; payloadHash: string; resultVersion: number; actorId: number }) { return (await tx.insert(expenseCommandsTable).values(values).returning())[0]; }
  async list(query: ExpensesQueryInput) { const conditions: SQL[] = [eq(expensesTable.storeId, query.storeId)]; if (query.status) conditions.push(eq(expensesTable.status, query.status)); if (query.from) conditions.push(gte(expensesTable.expenseDate, query.from)); if (query.to) conditions.push(lte(expensesTable.expenseDate, query.to)); const where = and(...conditions); const [{ total }] = await db.select({ total: count() }).from(expensesTable).where(where); const items = await db.select().from(expensesTable).where(where).orderBy(desc(expensesTable.expenseDate), desc(expensesTable.id)).limit(query.limit).offset((query.page - 1) * query.limit); const parsed = Number(total); return { items, meta: { total: parsed, page: query.page, limit: query.limit, totalPages: Math.ceil(parsed / query.limit), hasNextPage: query.page * query.limit < parsed } }; }
  async sourceMargin(query: SourceMarginQueryInput) {
    const orderConditions: SQL[] = [eq(ordersTable.storeId, query.storeId), eq(ordersTable.status, "delivered")];
    const expenseConditions: SQL[] = [eq(expensesTable.storeId, query.storeId), inArray(expensesTable.status, ["paid", "posted"] as const)];
    if (query.from) { orderConditions.push(gte(ordersTable.pricingBusinessDate, query.from)); expenseConditions.push(gte(expensesTable.expenseDate, query.from)); }
    if (query.to) { orderConditions.push(lte(ordersTable.pricingBusinessDate, query.to)); expenseConditions.push(lte(expensesTable.expenseDate, query.to)); }
    const [salesRow, costsRow, expenseRow] = await Promise.all([
      db.select({ amount: sql<string>`coalesce(sum(${ordersTable.grandTotalPaise}), 0)::text` }).from(ordersTable).where(and(...orderConditions)),
      db.select({ amount: sql<string>`coalesce(sum(${orderItemsTable.lineCostPaise}), 0)::text`, totalLines: count(), costedLines: sql<number>`count(${orderItemsTable.lineCostPaise})`.mapWith(Number) }).from(orderItemsTable).innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId)).where(and(...orderConditions)),
      db.select({ amount: sql<string>`coalesce(sum(${expensesTable.totalPaise}), 0)::text` }).from(expensesTable).where(and(...expenseConditions)),
    ]);
    return { deliveredSalesPaise: safeAggregate(salesRow[0].amount, "Delivered sales"), cogsPaise: safeAggregate(costsRow[0].amount, "COGS"), operatingExpensesPaise: safeAggregate(expenseRow[0].amount, "Operating expenses"), totalOrderLines: Number(costsRow[0].totalLines), costedOrderLines: costsRow[0].costedLines };
  }
}
export default new ExpenseRepository();
