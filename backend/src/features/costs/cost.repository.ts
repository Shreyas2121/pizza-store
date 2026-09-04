import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db";
import { orderItemsTable, productCostVersionsTable, productsTable, storeProductsTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import type { CreateCostVersionInput, CostsQuery } from "./cost.schemas";

export class CostRepository {
  transaction<T>(work: (tx: TransactionType) => Promise<T>) { return db.transaction(work); }

  async findStoreProduct(storeProductId: number, executor: typeof db | TransactionType = db) {
    return (await executor.select().from(storeProductsTable).where(eq(storeProductsTable.id, storeProductId)))[0];
  }

  async lockStoreProduct(tx: TransactionType, id: number) {
    return (await tx.select().from(storeProductsTable).where(eq(storeProductsTable.id, id)).for("update"))[0];
  }

  async findOverlap(tx: TransactionType, input: CreateCostVersionInput) {
    const overlapsEnd = input.effectiveTo
      ? lte(productCostVersionsTable.effectiveFrom, input.effectiveTo)
      : undefined;
    return (await tx.select().from(productCostVersionsTable).where(and(
      eq(productCostVersionsTable.storeProductId, input.storeProductId),
      overlapsEnd,
      or(isNull(productCostVersionsTable.effectiveTo), gte(productCostVersionsTable.effectiveTo, input.effectiveFrom))
    )).limit(1))[0];
  }

  async create(tx: TransactionType, input: CreateCostVersionInput, createdBy: number) {
    return (await tx.insert(productCostVersionsTable).values({
      ...input,
      effectiveTo: input.effectiveTo ?? null,
      createdBy,
    }).returning())[0];
  }

  async list(query: CostsQuery) {
    const conditions = [eq(productCostVersionsTable.storeId, query.storeId)];
    if (query.storeProductId) conditions.push(eq(productCostVersionsTable.storeProductId, query.storeProductId));
    if (query.asOf) {
      conditions.push(lte(productCostVersionsTable.effectiveFrom, query.asOf));
      conditions.push(or(isNull(productCostVersionsTable.effectiveTo), gte(productCostVersionsTable.effectiveTo, query.asOf))!);
    }
    return db.select({
      cost: productCostVersionsTable,
      productId: storeProductsTable.productId,
      productName: productsTable.name,
    }).from(productCostVersionsTable)
      .innerJoin(storeProductsTable, eq(productCostVersionsTable.storeProductId, storeProductsTable.id))
      .innerJoin(productsTable, eq(storeProductsTable.productId, productsTable.id))
      .where(and(...conditions))
      .orderBy(asc(productsTable.name), desc(productCostVersionsTable.effectiveFrom));
  }

  async listOrderItems(tx: TransactionType, orderId: number) {
    return tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId)).orderBy(asc(orderItemsTable.id));
  }

  async lockStoreProducts(tx: TransactionType, storeId: number, productIds: number[]) {
    if (!productIds.length) return [];
    return tx.select().from(storeProductsTable).where(and(
      eq(storeProductsTable.storeId, storeId),
      inArray(storeProductsTable.productId, productIds)
    )).orderBy(asc(storeProductsTable.id)).for("update");
  }

  async findEffectiveCosts(tx: TransactionType, storeProductIds: number[], businessDate: string) {
    if (!storeProductIds.length) return [];
    return tx.select().from(productCostVersionsTable).where(and(
      inArray(productCostVersionsTable.storeProductId, storeProductIds),
      lte(productCostVersionsTable.effectiveFrom, businessDate),
      or(isNull(productCostVersionsTable.effectiveTo), gte(productCostVersionsTable.effectiveTo, businessDate))
    )).orderBy(asc(productCostVersionsTable.storeProductId));
  }

  async snapshotOrderItem(tx: TransactionType, input: {
    orderItemId: number; costVersionId: number; unitCostPaise: number; lineCostPaise: number;
  }) {
    return (await tx.update(orderItemsTable).set({
      costVersionId: input.costVersionId,
      unitCostPaise: input.unitCostPaise,
      lineCostPaise: input.lineCostPaise,
      updatedAt: new Date(),
    }).where(and(eq(orderItemsTable.id, input.orderItemId), isNull(orderItemsTable.costVersionId))).returning())[0];
  }
}

export default new CostRepository();
