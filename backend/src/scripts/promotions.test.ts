import { beforeEach, expect, it, vi } from "vitest";
import { bundleComponentsTable, menuItemsMappingTable, promotionsTable, promotionRulesTable,
  storeProductsTable, storePromotionSettingsTable, usersTable } from "../db/schema";
import { seedPromotions } from "./promotions";

const state = vi.hoisted(() => ({ existing: false, missingAdmin: false, writes: [] as { table: unknown; values: unknown }[] }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock("../fixtures/promotion-media.fixtures", () => ({ promotionFixtureArtwork: vi.fn(async () => Buffer.from("fixture")) }));
vi.mock("../db", async () => {
  const schema = await import("../db/schema");
  const tx = {
    execute: vi.fn(),
    select: () => ({ from: (table: unknown) => {
      const rows = table === schema.usersTable ? (state.missingAdmin ? [] : [{ id: 1 }]) :
        table === schema.productsTable ? [
          { id: 11, slug: "margherita-pizza", categoryId: 4 }, { id: 12, slug: "coca-cola", categoryId: 5 },
          ...(state.existing ? [{ id: 13, slug: "pizza-and-coke-combo", productType: "bundle" }] : []),
        ] : table === schema.storesTable ? [{ id: 1, slug: "pizzastore-default" }, { id: 2, slug: "pizzastore-bengaluru-south" }] :
          table === schema.promotionsTable ? (state.existing ? [{ id: 1 }] : []) :
            table === schema.menuItemsMappingTable ? (state.existing ? [{ productId: 13 }] : []) : [{ id: 1 }];
      const result = Object.assign(Promise.resolve(rows), {
        where: () => result, orderBy: () => result, limit: () => Promise.resolve(rows),
      });
      return result;
    } }),
    insert: (table: unknown) => ({ values: (values: unknown) => {
      state.writes.push({ table, values });
      const result = Object.assign(Promise.resolve(), {
        onConflictDoNothing: () => result,
        returning: async () => table === schema.productsTable ? (state.existing ? [] : [{ id: 13, productType: "bundle" }]) : [{ id: state.writes.length }],
      });
      return result;
    } }),
  };
  return { db: { transaction: async (run: (executor: typeof tx) => Promise<unknown>) => run(tx) } };
});
beforeEach(() => { state.existing = false; state.missingAdmin = false; state.writes = []; });

it("seeds one component-backed combo, all definitions and only the explicit Bengaluru setting", async () => {
  expect(await seedPromotions()).toEqual({ created: 8, totalFixtures: 8, bundleProductId: 13 });
  expect(state.writes.filter((w) => w.table === promotionsTable)).toHaveLength(8);
  expect(state.writes.filter((w) => w.table === promotionsTable).map((w) => w.values)).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Demo pizza 10 percent", showOnHomepage: true, mobileImageUrl: expect.stringContaining(".webp") }),
    expect.objectContaining({ name: "Demo pizza 20 rupees off", showOnHomepage: true, imageUrl: expect.stringContaining(".webp"), mobileImageUrl: null }),
    expect.objectContaining({ name: "Demo buy two get one pizza", imageUrl: null }),
  ]));
  expect(state.writes.find((w) => w.table === bundleComponentsTable)?.values).toEqual([
    { bundleProductId: 13, componentProductId: 11, quantity: 1 }, { bundleProductId: 13, componentProductId: 12, quantity: 1 },
  ]);
  expect(state.writes.find((w) => w.table === storeProductsTable)?.values).toEqual(expect.arrayContaining([
    expect.objectContaining({ storeId: 1, pricePaise: 32_900, compareAtPricePaise: 35_900, onHandQuantity: null }),
    expect.objectContaining({ storeId: 2, onHandQuantity: null }),
  ]));
  expect(state.writes.filter((w) => w.table === storePromotionSettingsTable)).toEqual([
    expect.objectContaining({ values: expect.objectContaining({ storeId: 2, isEnabled: false }) }),
  ]);
  expect(state.writes.some((w) => w.table === promotionRulesTable)).toBe(true);
  expect(state.writes.some((w) => w.table === menuItemsMappingTable)).toBe(true);
  expect(state.writes.some((w) => w.table === usersTable)).toBe(false);
});
it("reuses existing fixture definitions without replacing rules, media or store choices", async () => {
  state.existing = true;
  expect(await seedPromotions()).toEqual({ created: 0, totalFixtures: 8, bundleProductId: 13 });
  for (const table of [promotionsTable, promotionRulesTable, storePromotionSettingsTable, menuItemsMappingTable])
    expect(state.writes.some((w) => w.table === table)).toBe(false);
});
it("rejects missing seed prerequisites before creating catalogue or promotion rows", async () => {
  state.missingAdmin = true;
  await expect(seedPromotions()).rejects.toThrow("requires an admin");
  expect(state.writes).toEqual([]);
});
