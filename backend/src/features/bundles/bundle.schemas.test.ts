import { describe, expect, it } from "vitest";
import { bundleDefinitionWriteSchema } from "./bundle.schemas";

const valid = {
  components: [{ productId: 11, quantityPerBundle: 1 }],
  storePrices: [{ storeId: 1, sellingPricePaise: 30_000, compareAtPricePaise: 36_000 }],
};

describe("bundleDefinitionWriteSchema", () => {
  it("accepts exact paise prices and supplies availability", () => {
    expect(bundleDefinitionWriteSchema.parse(valid).storePrices[0].isAvailable).toBe(true);
  });

  it("rejects equal or lower compare-at prices", () => {
    expect(bundleDefinitionWriteSchema.safeParse({
      ...valid,
      storePrices: [{ storeId: 1, sellingPricePaise: 30_000, compareAtPricePaise: 30_000 }],
    }).success).toBe(false);
  });

  it("rejects duplicate components and duplicate stores", () => {
    expect(bundleDefinitionWriteSchema.safeParse({
      components: [
        { productId: 11, quantityPerBundle: 1 },
        { productId: 11, quantityPerBundle: 2 },
      ],
      storePrices: [
        { storeId: 1, sellingPricePaise: 30_000, compareAtPricePaise: 36_000 },
        { storeId: 1, sellingPricePaise: 31_000, compareAtPricePaise: 36_000 },
      ],
    }).success).toBe(false);
  });

  it("is strict and rejects float quantities", () => {
    expect(bundleDefinitionWriteSchema.safeParse({
      ...valid,
      unexpected: true,
      components: [{ productId: 11, quantityPerBundle: 1.5 }],
    }).success).toBe(false);
  });
});
