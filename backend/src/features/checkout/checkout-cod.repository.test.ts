import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  productsTable,
  storeProductsTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { CodCheckoutRepository } from "./checkout-cod.repository";
import { publicQuoteRepository } from "./checkout.repository";

const harness = () => {
  const events: Array<{
    table: unknown;
    conditions?: unknown[];
    order?: string[];
    lock?: string;
  }> = [];
  const dialect = new PgDialect();
  const executor = {
    select: () => ({
      from: (table: unknown) => {
        const event: (typeof events)[number] = { table };
        events.push(event);
        const query = {
          where: (condition: SQL) => {
            event.conditions = dialect.sqlToQuery(condition).params;
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
          then: (resolve: (value: unknown[]) => unknown) =>
            Promise.resolve([]).then(resolve),
        };
        return query;
      },
    }),
  };
  // Only read/lock query construction is implemented; PostgreSQL is not used.
  return {
    tx: executor as unknown as TransactionType,
    events,
    repository: new CodCheckoutRepository(),
  };
};
const bundles = () =>
  new Map([
    [
      30,
      {
        bundleProductId: 30,
        bundleName: "Meal",
        components: [
          {
            productId: 10,
            name: "Drink",
            quantityPerBundle: 2,
            isAvailable: true,
          },
        ],
      },
    ],
  ]);
describe("COD catalogue lock boundaries", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("locks parent and component products before the complete store-product set in ascending ID order", async () => {
    const h = harness();
    vi.spyOn(publicQuoteRepository, "findBundleDefinitions").mockResolvedValue(
      bundles(),
    );
    await h.repository.lockCatalogue(1, [30, 20], [5], h.tx);
    expect(h.events).toEqual([
      {
        table: productsTable,
        conditions: [30, 20, 10],
        order: ['"products"."id" asc'],
        lock: "no key update",
      },
      {
        table: storeProductsTable,
        conditions: [1, 30, 20, 10],
        order: ['"store_products"."id" asc'],
        lock: "update",
      },
      {
        table: customizationOptionsTable,
        conditions: [5],
        order: ['"customization_options"."id" asc'],
        lock: "no key update",
      },
      {
        table: productCustomizationGroupMappingTable,
        conditions: [30, 20],
        order: [
          '"product_customization_group_mapping"."product_id" asc',
          '"product_customization_group_mapping"."group_id" asc',
        ],
        lock: "update",
      },
    ]);
    expect(publicQuoteRepository.findBundleDefinitions).toHaveBeenCalledWith(
      1,
      [30, 20],
      h.tx,
    );
  });
  it("rejects a changed bundle identity rather than acquiring new out-of-order locks", async () => {
    const h = harness();
    const next = bundles();
    next.get(30)!.components[0].productId = 1;
    vi.spyOn(publicQuoteRepository, "findBundleDefinitions")
      .mockResolvedValueOnce(bundles())
      .mockResolvedValueOnce(next);
    await expect(
      h.repository.lockCatalogue(1, [30], [], h.tx),
    ).rejects.toMatchObject({ code: "CHECKOUT_CATALOGUE_CHANGED" });
    expect(h.events).toHaveLength(1);
    expect(h.events[0].table).toBe(productsTable);
  });
});
