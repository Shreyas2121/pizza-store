import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error";
import {
  buildBundleProductDto,
  calculateBundleMarkdown,
  createBundleComponentSnapshots,
  expandBundleDemand,
  validateBundleDefinition,
} from "./bundle.logic";
import type { BundleDefinition } from "./bundle.types";

const definition = (components: BundleDefinition["components"]): BundleDefinition => ({
  bundleProductId: 30,
  bundleName: "Pizza + Drink",
  components,
});

describe("bundle definition rules", () => {
  it("accepts distinct single-product components", () => {
    expect(() => validateBundleDefinition({
      bundleProductId: 30,
      bundleProductType: "bundle",
      components: [
        { productId: 11, productType: "single", quantityPerBundle: 1 },
        { productId: 20, productType: "single", quantityPerBundle: 2 },
      ],
    })).not.toThrow();
  });

  it.each([
    {
      components: [{ productId: 30, productType: "bundle" as const, quantityPerBundle: 1 }],
      code: "NESTED_BUNDLE_NOT_ALLOWED",
    },
    {
      components: [
        { productId: 11, productType: "single" as const, quantityPerBundle: 1 },
        { productId: 11, productType: "single" as const, quantityPerBundle: 2 },
      ],
      code: "DUPLICATE_BUNDLE_COMPONENT",
    },
  ])("rejects invalid component definitions %#", ({ components, code }) => {
    expect(() => validateBundleDefinition({
      bundleProductId: 30,
      bundleProductType: "bundle",
      components,
    })).toThrowError(expect.objectContaining({ code }));
  });
});

describe("bundle merchandising", () => {
  it("calculates per-line markdown without changing the selling price", () => {
    expect(calculateBundleMarkdown(30_000, 36_000, 3)).toBe(18_000);
  });

  it.each([[30_000, 30_000], [30_000, 29_999]])(
    "rejects compare-at %s / selling %s",
    (selling, compareAt) => {
      expect(() => calculateBundleMarkdown(selling, compareAt)).toThrowError(
        expect.objectContaining({ code: "BUNDLE_PRICE_INVALID" })
      );
    }
  );

  it("sorts contents and disables the bundle for unavailable components", () => {
    const dto = buildBundleProductDto({
      productId: 30,
      name: "Combo",
      description: null,
      imageUrl: "/combo.webp",
      storeId: 2,
      sellingPricePaise: 30_000,
      compareAtPricePaise: 36_000,
      bundleIsAvailable: true,
      components: [
        { productId: 20, name: "Cola", quantityPerBundle: 1, isAvailable: false },
        { productId: 11, name: "Pizza", quantityPerBundle: 1, isAvailable: true },
      ],
    });
    expect(dto).toMatchObject({
      sellingPricePaise: 30_000,
      compareAtPricePaise: 36_000,
      markdownPaise: 6_000,
      isAvailable: false,
      unavailableComponentIds: [20],
    });
    expect(dto.components.map((item) => item.productId)).toEqual([11, 20]);
  });

  it("keeps store-specific selling prices and markdowns independent", () => {
    const common = {
      productId: 30,
      name: "Combo",
      description: null,
      imageUrl: "/combo.webp",
      compareAtPricePaise: 36_000,
      bundleIsAvailable: true,
      components: [{ productId: 11, name: "Pizza", quantityPerBundle: 1, isAvailable: true }],
    };
    const firstStore = buildBundleProductDto({ ...common, storeId: 1, sellingPricePaise: 30_000 });
    const secondStore = buildBundleProductDto({ ...common, storeId: 2, sellingPricePaise: 32_000 });
    expect([firstStore.markdownPaise, secondStore.markdownPaise]).toEqual([6_000, 4_000]);
  });
});

describe("component inventory demand", () => {
  it("expands multiplied and duplicate components and aggregates standalone demand", () => {
    const definitions = new Map([
      [30, definition([
        { productId: 11, name: "Pizza", quantityPerBundle: 2, isAvailable: true },
        { productId: 20, name: "Cola", quantityPerBundle: 1, isAvailable: true },
      ])],
      [31, { ...definition([
        { productId: 20, name: "Cola", quantityPerBundle: 2, isAvailable: true },
      ]), bundleProductId: 31 }],
    ]);
    const demand = expandBundleDemand([
      { productId: 30, quantity: 3 },
      { productId: 31, quantity: 1 },
      { productId: 20, quantity: 4 },
    ], definitions);
    expect([...demand.entries()]).toEqual([[11, 6], [20, 9]]);
  });

  it("rejects unavailable components before stock allocation", () => {
    expect(() => expandBundleDemand(
      [{ productId: 30, quantity: 1 }],
      new Map([[30, definition([
        { productId: 20, name: "Cola", quantityPerBundle: 1, isAvailable: false },
      ])]])
    )).toThrowError(expect.objectContaining({
      code: "BUNDLE_COMPONENT_UNAVAILABLE",
      data: { bundleProductId: 30, unavailableComponentIds: [20] },
    }));
  });

  it("creates immutable, sorted, multiplied component snapshots", () => {
    expect(createBundleComponentSnapshots(definition([
      { productId: 20, name: "Cola", quantityPerBundle: 2, isAvailable: true },
      { productId: 11, name: "Pizza", quantityPerBundle: 1, isAvailable: true },
    ]), 3)).toEqual([
      { productId: 11, name: "Pizza", quantityPerBundle: 1, totalQuantity: 3 },
      { productId: 20, name: "Cola", quantityPerBundle: 2, totalQuantity: 6 },
    ]);
  });

  it("uses stable domain errors", () => {
    expect(() => expandBundleDemand([{ productId: 1, quantity: 0 }], new Map()))
      .toThrow(AppError);
  });
});
