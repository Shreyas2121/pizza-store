import { describe, expect, it, vi } from "vitest";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { storesTable, promotionsTable, promotionApplicationsTable, ordersTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { PromotionRepository } from "./promotion.repository";
import type { PromotionRow } from "./promotion.mapper";
import { db } from "../../db";
import { MAX_POSTGRES_INT } from "../../utils/money";
import {
  PromotionPricingRepository,
  occupiedPromotionInteger,
} from "./promotion-pricing.repository";

const now = new Date("2026-09-15");
const row: PromotionRow = {
  id: 10, definitionVersion: 1, kind: "offer", name: "Offer", description: "Offer details", code: null,
  discountType: "percentage", discountRateBps: 1_000, discountAmountPaise: null, maxDiscountPaise: null,
  scope: "cart", includeCustomizationValue: false, minimumOrderPaise: 0, minimumCartQuantity: 0, firstOrderOnly: true,
  startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), activeDaysOfWeek: null, activeStartTime: null, activeEndTime: null,
  perUserRedemptionLimit: null, maxRedemptions: null, totalDiscountBudgetPaise: null, displayPriority: 0,
  imageUrl: null, mobileImageUrl: null, imageAlt: null, showOnHomepage: false, isActive: true, createdAt: now, updatedAt: now,
};
const loadHarness = () => {
  const events: Array<{ table: unknown; lock?: string; params?: unknown[] }> = [];
  const rows = new Map<unknown, unknown[]>([[storesTable, [{ id: 1 }]], [promotionsTable, [row]],
    [promotionApplicationsTable, [{ promotionId: 10, used: "2" }]], [ordersTable, [{ id: 99 }]]]);
  const executor = { select: () => ({ from: (table: unknown) => {
    const event: typeof events[number] = { table }; events.push(event);
    const query = {
      where: (condition: SQL) => { event.params = new PgDialect().sqlToQuery(condition).params; return query; },
      orderBy: () => query, limit: () => query, groupBy: () => query,
      for: (lock: string) => { event.lock = lock; return query; },
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows.get(table) ?? []).then(resolve),
    };
    return query;
  } }) };
  // This executor implements only reads exercised here; no connection exists.
  const tx = executor as unknown as TransactionType;
  const related = new PromotionRepository();
  vi.spyOn(related, "related").mockResolvedValue({ rules: [], settings: [],
    usage: new Map([[10, { redemptions: "3", budgetPaise: "12000" }]]) });
  return { source: new PromotionPricingRepository(related), related, tx, rows, events };
};

describe("promotion pricing query boundaries", () => {
  it("locks the active store then promotions and batches usage with the same executor", async () => {
    const h = loadHarness();
    const result = await h.source.load(1, 7, null, now, { executor: h.tx, lockPromotions: true });
    expect(h.events.slice(0, 2)).toMatchObject([{ table: storesTable, lock: "update" }, { table: promotionsTable, lock: "update" }]);
    expect(h.related.related).toHaveBeenCalledExactlyOnceWith([10], 1, h.tx, true);
    expect(result.usageByPromotionId[10]).toEqual({ storeEnabled: true, globalRedemptionsUsed: 3, userRedemptionsUsed: 2, budgetUsedPaise: 12000 });
    expect(result.qualifyingOrderCount).toBe(1);
    expect(h.events.find(event => event.table === ordersTable)?.params).toEqual([7, "awaiting_payment", "pending", "preparing", "out_for_delivery", "delivered"]);
    expect(h.events.find(event => event.table === promotionApplicationsTable)?.params).toEqual([10, 7, "reserved", "consumed"]);
  });
  it("reads no personal usage/orders for anonymous previews and takes no locks", async () => {
    const h = loadHarness();
    const result = await h.source.load(1, null, null, now, { executor: h.tx });
    expect(h.events.map(event => event.table)).toEqual([promotionsTable]);
    expect(h.events.every(event => event.lock === undefined)).toBe(true);
    expect(result.qualifyingOrderCount).toBe(0); expect(result.usageByPromotionId[10].userRedemptionsUsed).toBe(0);
  });
  it("rejects a store that became inactive before final lock acquisition", async () => {
    const h = loadHarness(); h.rows.set(storesTable, []);
    await expect(h.source.load(1, 7, null, now, { executor: h.tx, lockPromotions: true })).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(h.events).toHaveLength(1); expect(h.related.related).not.toHaveBeenCalled();
  });
  it("loads automatic offers but only the explicitly supplied coupon, ordered for locking", () => {
    const query = new PromotionPricingRepository()
      .candidateQuery(db, "SAVE", new Date("2026-09-15"))
      .toSQL();
    expect(query.sql).toContain('"promotions"."kind" =');
    expect(query.params).toContain("offer");
    expect(query.params).toContain("coupon");
    expect(query.params).toContain("SAVE");
    expect(query.sql).toContain('"promotions"."code" =');
    expect(query.sql).toContain('order by "promotions"."id" asc');
    expect(query.sql).not.toMatch(/\blimit\s+\$/);
    expect(query.sql).toContain('"promotions"."ends_at" >');
  });
  it("never reads coupon rows for an absent code", () => {
    const query = new PromotionPricingRepository()
      .candidateQuery(db, null, new Date("2026-09-15"))
      .toSQL();
    expect(query.params).not.toContain("coupon");
    expect(query.params).not.toContain(null);
  });
  it("handles exact large lifetime aggregates conservatively without unsafe coercion", () => {
    expect(occupiedPromotionInteger("123456")).toBe(123456);
    expect(occupiedPromotionInteger("9007199254740993123456")).toBe(
      MAX_POSTGRES_INT,
    );
    for (const invalid of ["-1", "1.5", "NaN", "1e10", ""])
      expect(() => occupiedPromotionInteger(invalid)).toThrow();
  });
  it("cannot request locks without a caller executor", async () => {
    await expect(
      new PromotionPricingRepository().load(1, 7, null, new Date(), {
        lockPromotions: true,
      }),
    ).rejects.toMatchObject({ code: "PRICING_TRANSACTION_REQUIRED" });
  });
});
