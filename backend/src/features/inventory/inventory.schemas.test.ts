import { describe, expect, it } from "vitest";
import {
  adjustInventorySchema,
  bulkRestockInventorySchema,
  inventoryListQuerySchema,
  inventoryMovementsQuerySchema,
  restockInventorySchema,
  updateInventoryThresholdSchema,
} from "./inventory.schemas";

describe("inventory query validation", () => {
  it("applies bounded pagination defaults", () => {
    expect(inventoryListQuerySchema.parse({})).toEqual({
      status: "all",
      page: 1,
      limit: 20,
    });
  });

  it("rejects an excessive page limit", () => {
    expect(() => inventoryListQuerySchema.parse({ limit: "101" })).toThrow();
  });

  it("rejects an inverted movement date range", () => {
    expect(() =>
      inventoryMovementsQuerySchema.parse({
        from: "2026-08-25T00:00:00.000Z",
        to: "2026-08-24T00:00:00.000Z",
      })
    ).toThrow();
  });
});

describe("inventory mutation validation", () => {
  it("accepts a positive restock", () => {
    expect(restockInventorySchema.parse({ quantityAdded: 5 })).toEqual({
      quantityAdded: 5,
    });
  });

  it("rejects a zero restock", () => {
    expect(() => restockInventorySchema.parse({ quantityAdded: 0 })).toThrow();
  });

  it("requires a non-empty adjustment reason", () => {
    expect(() =>
      adjustInventorySchema.parse({ targetQuantity: 2, reason: "  " })
    ).toThrow();
  });

  it("accepts zero for adjustment and threshold", () => {
    expect(
      adjustInventorySchema.parse({ targetQuantity: 0, reason: "Stocktake" })
    ).toEqual({ targetQuantity: 0, reason: "Stocktake" });
    expect(updateInventoryThresholdSchema.parse({ threshold: 0 })).toEqual({
      threshold: 0,
    });
  });

  it("rejects duplicate products in a bulk restock", () => {
    expect(() =>
      bulkRestockInventorySchema.parse({
        items: [
          { productId: 1, quantityAdded: 2 },
          { productId: 1, quantityAdded: 3 },
        ],
      })
    ).toThrow();
  });

  it("limits bulk restock to 50 products", () => {
    expect(() =>
      bulkRestockInventorySchema.parse({
        items: Array.from({ length: 51 }, (_, index) => ({
          productId: index + 1,
          quantityAdded: 1,
        })),
      })
    ).toThrow();
  });
});
