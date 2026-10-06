import { beforeEach, describe, expect, it, vi } from "vitest";
import { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { productsTable, storesTable } from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { BundleService } from "./bundle.service";

const harness = (storeRows: number[]) => {
  const events: Array<{ table: unknown; order?: string[]; lock?: string }> = [];
  const dialect = new PgDialect();
  const executor = {
    select: () => ({
      from: (table: unknown) => {
        const event: (typeof events)[number] = { table };
        events.push(event);
        const query = {
          where: () => query,
          orderBy: (...values: SQL[]) => {
            event.order = values.map((value) => dialect.sqlToQuery(value).sql);
            return query;
          },
          for: (lock: string) => {
            event.lock = lock;
            return query;
          },
          then: (resolve: (rows: unknown[]) => unknown) =>
            Promise.resolve(
              table === storesTable ? storeRows.map((id) => ({ id })) : [],
            ).then(resolve),
        };
        return query;
      },
    }),
  };
  // Only lock acquisition and validation reads are allowed in these tests.
  const tx = executor as unknown as TransactionType;
  vi.spyOn(db, "transaction").mockImplementation(async (operation) =>
    operation(tx),
  );
  return { events };
};
const input = {
  components: [{ productId: 10, quantityPerBundle: 1 }],
  storePrices: [
    {
      storeId: 2,
      sellingPricePaise: 1000,
      compareAtPricePaise: 1500,
      isAvailable: true,
    },
    {
      storeId: 1,
      sellingPricePaise: 1000,
      compareAtPricePaise: 1500,
      isAvailable: true,
    },
  ],
};
describe("bundle writer checkout-compatible locks", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("locks all stores ascending before parent/components ascending", async () => {
    const h = harness([1, 2]);
    await expect(
      new BundleService().replaceDefinition(30, input),
    ).rejects.toMatchObject({ code: "BUNDLE_NOT_FOUND" });
    expect(h.events).toEqual([
      { table: storesTable, order: ['"stores"."id" asc'], lock: "update" },
      { table: productsTable, order: ['"products"."id" asc'], lock: "update" },
    ]);
  });
  it("rejects missing stores before product locks or writes", async () => {
    const h = harness([1]);
    await expect(
      new BundleService().replaceDefinition(30, input),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(h.events).toHaveLength(1);
  });
});
