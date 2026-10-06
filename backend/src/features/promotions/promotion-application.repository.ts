import { PROMOTION_ERROR_CODES } from "./promotion.constants";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  ordersTable,
  usersTable,
  storesTable,
  promotionsTable,
  storePromotionSettingsTable,
  promotionApplicationsTable,
  promotionDiscountAllocationsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { AppError } from "../../utils/error";

export type ApplicationRow = typeof promotionApplicationsTable.$inferSelect;
export type ApplicationWrite = typeof promotionApplicationsTable.$inferInsert;
export type AllocationWrite =
  typeof promotionDiscountAllocationsTable.$inferInsert;
export type ApplicationStatus = ApplicationRow["status"];

export class PromotionApplicationRepository {
  async lockOwner(orderId: number, tx: TransactionType) {
    const [order] = await tx
      .select({
        id: ordersTable.id,
        userId: ordersTable.userId,
        storeId: ordersTable.storeId,
        discountMode: ordersTable.discountMode,
        discountPaise: ordersTable.discountPaise,
        deliveryFeePaise: ordersTable.deliveryFeePaise,
        grandTotalPaise: ordersTable.grandTotalPaise,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, order.userId))
      .for("update");
    await tx
      .select({ id: storesTable.id })
      .from(storesTable)
      .where(eq(storesTable.id, order.storeId))
      .for("update");
    return order;
  }
  async applications(orderId: number, tx: TransactionType, lock = false) {
    const query = tx
      .select()
      .from(promotionApplicationsTable)
      .where(eq(promotionApplicationsTable.orderId, orderId))
      .orderBy(asc(promotionApplicationsTable.id));
    return lock ? query.for("update") : query;
  }
  async lockDefinitions(ids: number[], storeId: number, tx: TransactionType) {
    if (!ids.length) return { promotions: [], settings: [] };
    const promotions = await tx
      .select()
      .from(promotionsTable)
      .where(inArray(promotionsTable.id, ids))
      .orderBy(asc(promotionsTable.id))
      .for("update");
    const settings = await tx
      .select()
      .from(storePromotionSettingsTable)
      .where(
        and(
          eq(storePromotionSettingsTable.storeId, storeId),
          inArray(storePromotionSettingsTable.promotionId, ids),
        ),
      )
      .orderBy(asc(storePromotionSettingsTable.promotionId))
      .for("update");
    return { promotions, settings };
  }
  async usage(ids: number[], userId: number, tx: TransactionType) {
    if (!ids.length) return [];
    return tx
      .select({
        promotionId: promotionApplicationsTable.promotionId,
        count: sql<string>`count(*)::text`,
        userCount: sql<string>`count(*) filter (where ${promotionApplicationsTable.userId} = ${userId})::text`,
        budget: sql<string>`coalesce(sum(${promotionApplicationsTable.totalSavingsPaise}::bigint), 0)::text`,
      })
      .from(promotionApplicationsTable)
      .where(
        and(
          inArray(promotionApplicationsTable.promotionId, ids),
          inArray(promotionApplicationsTable.status, ["reserved", "consumed"]),
        ),
      )
      .groupBy(promotionApplicationsTable.promotionId);
  }
  async allocations(ids: number[], tx: TransactionType) {
    if (!ids.length) return [];
    return tx
      .select()
      .from(promotionDiscountAllocationsTable)
      .where(
        inArray(promotionDiscountAllocationsTable.promotionApplicationId, ids),
      )
      .orderBy(asc(promotionDiscountAllocationsTable.id));
  }
  async insert(rows: ApplicationWrite[], tx: TransactionType) {
    if (!rows.length) return [];
    return tx.insert(promotionApplicationsTable).values(rows).returning();
  }
  async insertAllocations(rows: AllocationWrite[], tx: TransactionType) {
    if (rows.length)
      await tx.insert(promotionDiscountAllocationsTable).values(rows);
  }
  async transition(
    ids: number[],
    from: ApplicationStatus,
    to: ApplicationStatus,
    now: Date,
    tx: TransactionType,
  ) {
    if (!ids.length) return;
    const rows = await tx
      .update(promotionApplicationsTable)
      .set({
        status: to,
        updatedAt: now,
        reservedAt: to === "reserved" ? now : undefined,
        consumedAt: to === "consumed" ? now : null,
        releasedAt: to === "released" ? now : null,
      })
      .where(
        and(
          inArray(promotionApplicationsTable.id, ids),
          eq(promotionApplicationsTable.status, from),
        ),
      )
      .returning({ id: promotionApplicationsTable.id });
    if (rows.length !== ids.length)
      throw new AppError(
        "Promotion collection changed",
        409,
        PROMOTION_ERROR_CODES.APPLICATION_MISMATCH,
      );
  }
}
