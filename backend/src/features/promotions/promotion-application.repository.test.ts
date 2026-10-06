import { describe, expect, it } from "vitest";
import { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  ordersTable,
  usersTable,
  storesTable,
  promotionsTable,
  storePromotionSettingsTable,
  promotionApplicationsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { PromotionApplicationRepository } from "./promotion-application.repository";

const harness = () => {
  const dialect = new PgDialect();
  const events: Array<{
    table: unknown;
    lock?: string;
    order?: string[];
    params?: unknown[];
    projections: Record<string, string>;
  }> = [];
  const rows = new Map<unknown, unknown[]>([
    [ordersTable, [{ id: 42, userId: 7, storeId: 1 }]],
    [usersTable, [{ id: 7 }]],
    [storesTable, [{ id: 1 }]],
  ]);
  const executor = {
    select: (fields: Record<string, unknown> = {}) => ({
      from: (table: unknown) => {
        const event: (typeof events)[number] = {
          table,
          projections: Object.fromEntries(
            Object.entries(fields).flatMap(([key, value]) =>
              value instanceof SQL
                ? [[key, dialect.sqlToQuery(value).sql]]
                : [],
            ),
          ),
        };
        events.push(event);
        const query = {
          where: (condition: SQL) => {
            event.params = dialect.sqlToQuery(condition).params;
            return query;
          },
          orderBy: (...order: SQL[]) => {
            event.order = order.map((value) => dialect.sqlToQuery(value).sql);
            return query;
          },
          for: (lock: string) => {
            event.lock = lock;
            return query;
          },
          groupBy: () => query,
          then: (resolve: (result: unknown[]) => unknown) =>
            Promise.resolve(rows.get(table) ?? []).then(resolve),
        };
        return query;
      },
    }),
  };
  // Query-only adapter; it cannot open a connection or execute SQL.
  return {
    tx: executor as unknown as TransactionType,
    events,
    rows,
    repository: new PromotionApplicationRepository(),
  };
};
describe("promotion application persistence queries", () => {
  it("serializes user then store, promotions/settings by ID, then application rows by ID", async () => {
    const h = harness();
    await h.repository.lockOwner(42, h.tx);
    await h.repository.lockDefinitions([20, 10], 1, h.tx);
    await h.repository.applications(42, h.tx, true);
    expect(h.events.filter((e) => e.lock).map((e) => e.table)).toEqual([
      usersTable,
      storesTable,
      promotionsTable,
      storePromotionSettingsTable,
      promotionApplicationsTable,
    ]);
    expect(h.events[3].order).toEqual(['"promotions"."id" asc']);
    expect(h.events[4].order).toEqual([
      '"store_promotion_settings"."promotion_id" asc',
    ]);
    expect(h.events[5].order).toEqual(['"promotion_applications"."id" asc']);
    expect(h.events[4].params).toEqual([1, 20, 10]);
    // An absent default-enabled setting still has the store lock above.
    expect(h.rows.has(storePromotionSettingsTable)).toBe(false);
  });
  it("derives global/user usage and exact bigint budgets from reserved plus consumed rows only", async () => {
    const h = harness();
    await h.repository.usage([10, 20], 7, h.tx);
    expect(h.events[0].params).toEqual([10, 20, "reserved", "consumed"]);
    expect(h.events[0].projections.count).toBe("count(*)::text");
    expect(h.events[0].projections.userCount).toContain(
      'filter (where "promotion_applications"."user_id" =',
    );
    expect(h.events[0].projections.budget).toContain(
      'sum("promotion_applications"."total_savings_paise"::bigint)',
    );
    expect(h.events[0].projections.budget).toContain("::text");
  });
  it("does not build IN-empty reads/writes for a zero-promotion collection", async () => {
    const h = harness();
    expect(await h.repository.lockDefinitions([], 1, h.tx)).toEqual({
      promotions: [],
      settings: [],
    });
    expect(await h.repository.usage([], 7, h.tx)).toEqual([]);
    expect(await h.repository.allocations([], h.tx)).toEqual([]);
    expect(await h.repository.insert([], h.tx)).toEqual([]);
    await h.repository.insertAllocations([], h.tx);
    await h.repository.transition([], "reserved", "consumed", new Date(), h.tx);
    expect(h.events).toEqual([]);
  });
});
