import { describe, expect, it } from "vitest";
import { createCostVersionSchema } from "./cost.schemas";

describe("cost schemas", () => {
  it("accepts integer-paise inclusive effective ranges", () => {
    expect(createCostVersionSchema.parse({
      storeId: 1, storeProductId: 2, unitCostPaise: 12_345,
      effectiveFrom: "2026-09-01", effectiveTo: "2026-10-01", source: "supplier review",
    }).unitCostPaise).toBe(12_345);
    expect(() => createCostVersionSchema.parse({
      storeId: 1, storeProductId: 2, unitCostPaise: 12_345,
      effectiveFrom: "2026-09-01", effectiveTo: "2026-09-01", source: "one day",
    })).not.toThrow();
  });

  it("rejects reversed ranges and floating-point money", () => {
    expect(() => createCostVersionSchema.parse({
      storeId: 1, storeProductId: 2, unitCostPaise: 12.5,
      effectiveFrom: "2026-10-01", effectiveTo: "2026-09-01", source: "bad",
    })).toThrow();
  });
});
