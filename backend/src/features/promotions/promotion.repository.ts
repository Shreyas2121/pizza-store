import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../db";
import {
  categoriesTable,
  productsTable,
  promotionsTable,
  promotionRulesTable,
  promotionApplicationsTable,
  storesTable,
  storePromotionSettingsTable,
} from "../../db/schema";
import type { DatabaseType, TransactionType } from "../../utils/types";
import {
  HOMEPAGE_FEATURED_OFFER_LIMIT,
  PROMOTION_LIST_MAX_PAGE_SIZE,
  PROMOTION_MEDIA_LIFECYCLE_LOCK_NAME,
} from "./promotion.constants";
import type {
  PromotionDefinitionWriteInput,
  PromotionListQuery,
} from "./promotion.schemas";
import { rulesToValues, type PromotionUsage } from "./promotion.mapper";
type Executor = DatabaseType | TransactionType;

// Identical precedence to promotionStatus; correlated aggregates use the capacity/budget indexes.
export const promotionStatusSql = (now: Date) => sql<string>`case
  when not ${promotionsTable.isActive} then 'inactive'
  when ${promotionsTable.startsAt} > ${now} then 'scheduled'
  when ${promotionsTable.endsAt} <= ${now} then 'expired'
  when (${promotionsTable.maxRedemptions} is not null and
    (select count(*) from ${promotionApplicationsTable} a where a.promotion_id = ${promotionsTable.id} and a.status in ('reserved', 'consumed')) >= ${promotionsTable.maxRedemptions})
    or (${promotionsTable.totalDiscountBudgetPaise} is not null and
    (select coalesce(sum(a.total_savings_paise::bigint), 0) from ${promotionApplicationsTable} a where a.promotion_id = ${promotionsTable.id} and a.status in ('reserved', 'consumed')) >= ${promotionsTable.totalDiscountBudgetPaise}) then 'exhausted'
  else 'active' end`;

export class PromotionRepository {
  transaction<T>(operation: (tx: TransactionType) => Promise<T>) {
    return db.transaction(operation);
  }
  async find(id: number, executor: Executor = db, lock = false) {
    const query = executor
      .select()
      .from(promotionsTable)
      .where(eq(promotionsTable.id, id));
    const rows = lock ? await query.for("update") : await query;
    return rows[0];
  }
  async store(id: number, executor: Executor = db, lock = false) {
    const query = executor
      .select()
      .from(storesTable)
      .where(eq(storesTable.id, id));
    const rows = lock ? await query.for("update") : await query;
    return rows[0];
  }
  async setting(storeId: number, promotionId: number, tx: TransactionType): Promise<typeof storePromotionSettingsTable.$inferSelect | undefined> {
    const [row] = await tx
      .select()
      .from(storePromotionSettingsTable)
      .where(
        and(
          eq(storePromotionSettingsTable.storeId, storeId),
          eq(storePromotionSettingsTable.promotionId, promotionId),
        ),
      )
      .for("update");
    return row;
  }
  async page(query: PromotionListQuery, now: Date) {
    const conditions: SQL[] = [];
    if (query.kind) conditions.push(eq(promotionsTable.kind, query.kind));
    if (query.status)
      conditions.push(eq(promotionStatusSql(now), query.status));
    const where = and(...conditions);
    const [{ totalItems }] = await db
      .select({ totalItems: count() })
      .from(promotionsTable)
      .where(where);
    const rows = await db
      .select()
      .from(promotionsTable)
      .where(where)
      .orderBy(desc(promotionsTable.displayPriority), asc(promotionsTable.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return { rows, totalItems };
  }
  async discovery(storeId: number, now: Date, featured: boolean) {
    return this.discoveryQuery(storeId, now, featured);
  }
  discoveryQuery(storeId: number, now: Date, featured: boolean) {
    return db
      .select({ promotion: promotionsTable })
      .from(promotionsTable)
      .leftJoin(
        storePromotionSettingsTable,
        and(
          eq(storePromotionSettingsTable.promotionId, promotionsTable.id),
          eq(storePromotionSettingsTable.storeId, storeId),
        ),
      )
      .where(
        and(
          eq(promotionsTable.kind, "offer"),
          eq(promotionStatusSql(now), "active"),
          sql`coalesce(${storePromotionSettingsTable.isEnabled}, true)`,
          featured ? eq(promotionsTable.showOnHomepage, true) : undefined,
        ),
      )
      .orderBy(desc(promotionsTable.displayPriority), asc(promotionsTable.id))
      .limit(
        featured ? HOMEPAGE_FEATURED_OFFER_LIMIT : PROMOTION_LIST_MAX_PAGE_SIZE,
      );
  }
  async rules(ids: number[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor
      .select()
      .from(promotionRulesTable)
      .where(inArray(promotionRulesTable.promotionId, ids))
      .orderBy(
        asc(promotionRulesTable.promotionId),
        asc(promotionRulesTable.id),
      );
  }
  async related(
    ids: number[],
    storeId?: number,
    executor: Executor = db,
    lockSettings = false,
  ) {
    if (ids.length === 0)
      return {
        rules: [],
        settings: [],
        usage: new Map<number, PromotionUsage>(),
      };
    const rules = await this.rules(ids, executor);
    const settingsQuery =
      storeId === undefined
        ? undefined
        : executor
            .select()
            .from(storePromotionSettingsTable)
            .where(
              and(
                eq(storePromotionSettingsTable.storeId, storeId),
                inArray(storePromotionSettingsTable.promotionId, ids),
              ),
            )
            .orderBy(asc(storePromotionSettingsTable.promotionId));
    const settings = settingsQuery
      ? await (lockSettings ? settingsQuery.for("update") : settingsQuery)
      : [];
    const usageRows = await executor
      .select({
        promotionId: promotionApplicationsTable.promotionId,
        redemptions: sql<string>`count(*)::text`,
        budgetPaise: sql<string>`coalesce(sum(${promotionApplicationsTable.totalSavingsPaise}::bigint), 0)::text`,
      })
      .from(promotionApplicationsTable)
      .where(
        and(
          inArray(promotionApplicationsTable.promotionId, ids),
          inArray(promotionApplicationsTable.status, ["reserved", "consumed"]),
        ),
      )
      .groupBy(promotionApplicationsTable.promotionId);
    return {
      rules,
      settings,
      usage: new Map(
        usageRows.map((row) => [
          row.promotionId,
          { redemptions: row.redemptions, budgetPaise: row.budgetPaise },
        ]),
      ),
    };
  }
  async insert(
    tx: TransactionType,
    value: typeof promotionsTable.$inferInsert,
  ) {
    const [row] = await tx.insert(promotionsTable).values(value).returning();
    return row;
  }
  async update(
    tx: TransactionType,
    id: number,
    value: Partial<typeof promotionsTable.$inferInsert>,
  ) {
    const [row] = await tx
      .update(promotionsTable)
      .set(value)
      .where(eq(promotionsTable.id, id))
      .returning();
    return row;
  }
  async replaceRules(
    tx: TransactionType,
    id: number,
    rules: PromotionDefinitionWriteInput["rules"],
  ) {
    await tx
      .delete(promotionRulesTable)
      .where(eq(promotionRulesTable.promotionId, id));
    const values = rulesToValues(id, rules);
    if (values.length > 0) await tx.insert(promotionRulesTable).values(values);
  }
  async validateTargets(
    tx: TransactionType,
    rules: PromotionDefinitionWriteInput["rules"],
  ) {
    const rows = rulesToValues(0, rules);
    const productIds = [
      ...new Set(
        rows.flatMap((r) => (r.productId == null ? [] : [r.productId])),
      ),
    ];
    const categoryIds = [
      ...new Set(
        rows.flatMap((r) => (r.categoryId == null ? [] : [r.categoryId])),
      ),
    ];
    const products = productIds.length
      ? await tx
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(inArray(productsTable.id, productIds))
      : [];
    const categories = categoryIds.length
      ? await tx
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(inArray(categoriesTable.id, categoryIds))
      : [];
    return (
      products.length === productIds.length &&
      categories.length === categoryIds.length
    );
  }
  async saveSetting(
    tx: TransactionType,
    storeId: number,
    promotionId: number,
    actorId: number,
    enabled: boolean,
    reason: string | null,
    now: Date,
  ) {
    const values = {
      storeId,
      promotionId,
      updatedByUserId: actorId,
      isEnabled: enabled,
      disabledReason: reason,
      updatedAt: now,
    };
    const [row] = await tx
      .insert(storePromotionSettingsTable)
      .values(values)
      .onConflictDoUpdate({
        target: [
          storePromotionSettingsTable.promotionId,
          storePromotionSettingsTable.storeId,
        ],
        set: values,
      })
      .returning();
    return row;
  }
  async mediaReferences(tx: TransactionType) {
    return tx
      .select({
        imageUrl: promotionsTable.imageUrl,
        mobileImageUrl: promotionsTable.mobileImageUrl,
      })
      .from(promotionsTable);
  }
  async isMediaReferenced(url: string) {
    const [row] = await db
      .select({ id: promotionsTable.id })
      .from(promotionsTable)
      .where(
        sql`${promotionsTable.imageUrl} = ${url} or ${promotionsTable.mobileImageUrl} = ${url}`,
      )
      .limit(1);
    return row !== undefined;
  }
  // Writers and cleanup share this transaction lock: no new reference can be
  // committed while cleanup checks references and removes an orphan.
  async lockMedia(tx: TransactionType) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${PROMOTION_MEDIA_LIFECYCLE_LOCK_NAME}))`,
    );
  }
}
export default new PromotionRepository();
