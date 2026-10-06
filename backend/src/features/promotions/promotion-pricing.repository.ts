import { and, asc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  ordersTable,
  promotionsTable,
  promotionApplicationsTable,
  storesTable,
} from "../../db/schema";
import type { DatabaseType, TransactionType } from "../../utils/types";
import { AppError } from "../../utils/error";
import { MAX_POSTGRES_INT } from "../../utils/money";
import { FIRST_ORDER_DISQUALIFYING_STATUSES } from "./promotion.constants";
import { PromotionRepository } from "./promotion.repository";
import { toPromotionRecord } from "./promotion.mapper";
import type { PromotionRecord, PromotionUsageContext } from "./promotion.types";

export interface PromotionPricingData {
  promotions: PromotionRecord[];
  qualifyingOrderCount: number;
  usageByPromotionId: Record<number, PromotionUsageContext>;
}
type Executor = DatabaseType | TransactionType;
export const occupiedPromotionInteger = (value: string) => {
  // Saturation conservatively exhausts finite PostgreSQL-int limits. Unlimited
  // definitions remain usable when lifetime aggregates exceed the engine int domain.
  if (!/^\d+$/.test(value))
    throw new AppError(
      "Invalid promotion usage aggregate",
      500,
      "PROMOTION_USAGE_INVALID",
    );
  const parsed = BigInt(value);
  return parsed > BigInt(MAX_POSTGRES_INT) ? MAX_POSTGRES_INT : Number(parsed);
};
export class PromotionPricingRepository {
  constructor(private readonly repository = new PromotionRepository()) {}
  candidateQuery(executor: Executor, code: string | null, now: Date) {
    // Retain inactive requested coupons for stable eligibility errors, without
    // enumerating codes. Discovery pagination must never truncate pricing candidates.
    return executor
      .select()
      .from(promotionsTable)
      .where(
        or(
          and(
            eq(promotionsTable.kind, "offer"),
            eq(promotionsTable.isActive, true),
            lte(promotionsTable.startsAt, now),
            gt(promotionsTable.endsAt, now),
          ),
          code === null
            ? undefined
            : and(
                eq(promotionsTable.kind, "coupon"),
                eq(promotionsTable.code, code),
              ),
        ),
      )
      .orderBy(asc(promotionsTable.id));
  }
  async load(
    storeId: number,
    userId: number | null,
    code: string | null,
    now: Date,
    options: { executor?: Executor; lockPromotions?: boolean } = {},
  ): Promise<PromotionPricingData> {
    const executor = options.executor ?? db;
    if (options.lockPromotions) {
      if (!options.executor)
        throw new AppError(
          "A caller transaction is required",
          500,
          "PRICING_TRANSACTION_REQUIRED",
        );
      // Store precedes all promotion rows: covers absence of a default-on setting.
      const stores = await executor
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(and(eq(storesTable.id, storeId), eq(storesTable.isActive, true)))
        .for("update");
      if (stores.length === 0) throw new AppError("Store is unavailable", 409, "STORE_NOT_FOUND");
    }
    const query = this.candidateQuery(executor, code, now);
    const rows = options.lockPromotions
      ? await query.for("update")
      : await query;
    const ids = rows.map((row) => row.id);
    const related = await this.repository.related(ids, storeId, executor, options.lockPromotions ?? false);
    const userUsage =
      userId === null || ids.length === 0
        ? []
        : await executor
            .select({
              promotionId: promotionApplicationsTable.promotionId,
              used: sql<string>`count(*)::text`,
            })
            .from(promotionApplicationsTable)
            .where(
              and(
                inArray(promotionApplicationsTable.promotionId, ids),
                eq(promotionApplicationsTable.userId, userId),
                inArray(promotionApplicationsTable.status, [
                  "reserved",
                  "consumed",
                ]),
              ),
            )
            .groupBy(promotionApplicationsTable.promotionId);
    const qualifying =
      userId === null
        ? []
        : await executor
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(
              and(
                eq(ordersTable.userId, userId),
                inArray(ordersTable.status, [
                  ...FIRST_ORDER_DISQUALIFYING_STATUSES,
                ]),
              ),
            )
            .limit(1);
    const settings = new Map(
      related.settings.map((row) => [row.promotionId, row.isEnabled]),
    );
    const perUser = new Map(
      userUsage.map((row) => [
        row.promotionId,
        occupiedPromotionInteger(row.used),
      ]),
    );
    const rules = new Map<number, typeof related.rules>();
    for (const rule of related.rules) {
      const group = rules.get(rule.promotionId) ?? [];
      group.push(rule);
      rules.set(rule.promotionId, group);
    }
    const usageByPromotionId: Record<number, PromotionUsageContext> = {};
    for (const row of rows) {
      const usage = related.usage.get(row.id);
      usageByPromotionId[row.id] = {
        storeEnabled: settings.get(row.id) ?? true,
        globalRedemptionsUsed: occupiedPromotionInteger(
          usage?.redemptions ?? "0",
        ),
        userRedemptionsUsed: perUser.get(row.id) ?? 0,
        budgetUsedPaise: occupiedPromotionInteger(usage?.budgetPaise ?? "0"),
      };
    }
    return {
      promotions: rows.map((row) =>
        toPromotionRecord(row, rules.get(row.id) ?? []),
      ),
      qualifyingOrderCount: qualifying.length,
      usageByPromotionId,
    };
  }
}
