import { and, asc, count, eq, isNull, like, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { expenseCategoriesTable, storesTable, vendorsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { CreateExpenseCategoryInput, CreateVendorInput, MasterListQuery, UpdateExpenseCategoryInput, UpdateVendorInput } from "./vendor.schemas";
import { escapeLikePattern, normalizeMasterName } from "./vendor.policy";

const listConditions = (
  table: { storeId: AnyPgColumn; isActive: AnyPgColumn; normalizedName: AnyPgColumn },
  query: MasterListQuery
) => {
  const conditions: SQL[] = [];
  if (query.storeId !== undefined) conditions.push(or(isNull(table.storeId), eq(table.storeId, query.storeId))!);
  if (!query.includeInactive) conditions.push(eq(table.isActive, true));
  if (query.search) conditions.push(like(table.normalizedName, `%${escapeLikePattern(normalizeMasterName(query.search))}%`));
  return conditions.length ? and(...conditions) : undefined;
};

export class VendorRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }

  async findStore(storeId: number, executor: typeof db | TransactionType = db) {
    return (await executor.select({ id: storesTable.id }).from(storesTable).where(eq(storesTable.id, storeId)))[0];
  }

  async findVendor(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(vendorsTable).where(eq(vendorsTable.id, id)))[0];
  }

  async lockVendor(tx: TransactionType, id: number) {
    return (await tx.select().from(vendorsTable).where(eq(vendorsTable.id, id)).for("update"))[0];
  }

  async createVendor(tx: TransactionType, input: CreateVendorInput, actorId: number) {
    return (await tx.insert(vendorsTable).values({
      ...input, storeId: input.storeId ?? null, normalizedName: normalizeMasterName(input.name),
      taxRegistrationNumber: input.taxRegistrationNumber ?? null, contactName: input.contactName ?? null,
      email: input.email ?? null, phone: input.phone ?? null, address: input.address ?? null,
      createdBy: actorId, updatedBy: actorId,
    }).returning())[0];
  }

  async updateVendor(tx: TransactionType, id: number, input: UpdateVendorInput, actorId: number) {
    return (await tx.update(vendorsTable).set({
      ...input,
      ...(input.name !== undefined ? { normalizedName: normalizeMasterName(input.name) } : {}),
      updatedBy: actorId, updatedAt: new Date(),
    }).where(eq(vendorsTable.id, id)).returning())[0];
  }

  async listVendors(query: MasterListQuery) {
    const where = listConditions(vendorsTable, query);
    const [{ total }] = await db.select({ total: count() }).from(vendorsTable).where(where);
    const items = await db.select().from(vendorsTable).where(where)
      .orderBy(asc(vendorsTable.normalizedName), asc(vendorsTable.id))
      .limit(query.limit).offset((query.page - 1) * query.limit);
    return this.page(items, Number(total), query);
  }

  async findCategory(id: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id)))[0];
  }

  async lockCategory(tx: TransactionType, id: number) {
    return (await tx.select().from(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id)).for("update"))[0];
  }

  async createCategory(tx: TransactionType, input: CreateExpenseCategoryInput, actorId: number) {
    return (await tx.insert(expenseCategoriesTable).values({
      ...input, storeId: input.storeId ?? null, parentId: input.parentId ?? null,
      ledgerAccountId: input.ledgerAccountId ?? null, normalizedName: normalizeMasterName(input.name),
      createdBy: actorId, updatedBy: actorId,
    }).returning())[0];
  }

  async updateCategory(tx: TransactionType, id: number, input: UpdateExpenseCategoryInput, actorId: number) {
    return (await tx.update(expenseCategoriesTable).set({
      ...input,
      ...(input.name !== undefined ? { normalizedName: normalizeMasterName(input.name) } : {}),
      updatedBy: actorId, updatedAt: new Date(),
    }).where(eq(expenseCategoriesTable.id, id)).returning())[0];
  }

  async hasActiveChildren(id: number, tx: TransactionType) {
    return Boolean((await tx.select({ id: expenseCategoriesTable.id }).from(expenseCategoriesTable)
      .where(and(eq(expenseCategoriesTable.parentId, id), eq(expenseCategoriesTable.isActive, true))).limit(1))[0]);
  }

  async listCategories(query: MasterListQuery) {
    const where = listConditions(expenseCategoriesTable, query);
    const [{ total }] = await db.select({ total: count() }).from(expenseCategoriesTable).where(where);
    const items = await db.select().from(expenseCategoriesTable).where(where)
      .orderBy(asc(expenseCategoriesTable.parentId), asc(expenseCategoriesTable.normalizedName), asc(expenseCategoriesTable.id))
      .limit(query.limit).offset((query.page - 1) * query.limit);
    return this.page(items, Number(total), query);
  }

  private page<T>(items: T[], total: number, query: MasterListQuery) {
    return { items, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit), hasNextPage: query.page * query.limit < total } };
  }
}

export default new VendorRepository();
