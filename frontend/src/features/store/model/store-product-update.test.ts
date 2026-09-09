import { describe, expect, it } from "vitest";
import { buildStoreProductUpdate } from "./store-product-update";

const original = { pricePaise: 29_900, isAvailable: true };

describe("store product update authorization", () => {
  it("builds an availability-only update for inventory staff", () => {
    expect(buildStoreProductUpdate(
      original,
      { pricePaise: 29_900, isAvailable: false },
      { canUpdatePrice: false, canUpdateAvailability: true },
    )).toEqual({ isAvailable: false });
  });

  it("builds both changed fields for a manager", () => {
    expect(buildStoreProductUpdate(
      original,
      { pricePaise: 31_900, isAvailable: false },
      { canUpdatePrice: true, canUpdateAvailability: true },
    )).toEqual({ pricePaise: 31_900, isAvailable: false });
  });

  it("does not include changed fields the actor cannot update", () => {
    expect(buildStoreProductUpdate(
      original,
      { pricePaise: 31_900, isAvailable: false },
      { canUpdatePrice: false, canUpdateAvailability: false },
    )).toEqual({});
  });
});
