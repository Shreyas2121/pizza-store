import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error";
import {
  aggregateCartDemand,
  assertAdjustmentCoversReservations,
  calculateAdjustment,
  calculateRestock,
  deriveStockStatus,
  getAvailableQuantity,
} from "./inventory.logic";

describe("aggregateCartDemand", () => {
  it("combines customized cart lines by base product", () => {
    const demand = aggregateCartDemand([
      { productId: 7, quantity: 1 },
      { productId: 7, quantity: 2 },
      { productId: 9, quantity: 1 },
    ]);

    expect([...demand.entries()]).toEqual([
      [7, 3],
      [9, 1],
    ]);
  });

  it.each([
    { productId: 0, quantity: 1 },
    { productId: 1, quantity: 0 },
    { productId: 1, quantity: 1.5 },
  ])("rejects invalid demand %#", (item) => {
    expect(() => aggregateCartDemand([item])).toThrow(AppError);
  });

  it("rejects unsafe aggregated quantities", () => {
    expect(() =>
      aggregateCartDemand([
        { productId: 1, quantity: Number.MAX_SAFE_INTEGER },
        { productId: 1, quantity: 1 },
      ])
    ).toThrow("Cart quantity is too large");
  });
});

describe("stock availability", () => {
  it("keeps untracked inventory unlimited", () => {
    expect(getAvailableQuantity(null, 100)).toBeNull();
    expect(deriveStockStatus(null, null, 10)).toBe("untracked");
  });

  it("subtracts reservations and never exposes a negative count", () => {
    expect(getAvailableQuantity(10, 3)).toBe(7);
    expect(getAvailableQuantity(2, 4)).toBe(0);
  });

  it.each([
    [0, 10, "out_of_stock"],
    [10, 10, "low_stock"],
    [11, 10, "in_stock"],
  ] as const)(
    "derives %s available at threshold %s as %s",
    (available, threshold, expected) => {
      expect(deriveStockStatus(20, available, threshold)).toBe(expected);
    }
  );
});

describe("admin stock changes", () => {
  it("calculates a restock movement", () => {
    expect(calculateRestock(3, 5)).toEqual({
      previousQuantity: 3,
      newQuantity: 8,
      quantityChange: 5,
    });
  });

  it("requires an opening adjustment before restocking untracked stock", () => {
    expect(() => calculateRestock(null, 5)).toThrowError(
      expect.objectContaining({ code: "INVENTORY_NOT_TRACKED", status: 409 })
    );
  });

  it("uses the first adjustment as the tracked opening balance", () => {
    expect(calculateAdjustment(null, 12)).toEqual({
      previousQuantity: 0,
      newQuantity: 12,
      quantityChange: 12,
    });
  });

  it("calculates downward adjustments", () => {
    expect(calculateAdjustment(12, 5)).toEqual({
      previousQuantity: 12,
      newQuantity: 5,
      quantityChange: -7,
    });
  });

  it("rejects an adjustment below reserved stock", () => {
    expect(() => assertAdjustmentCoversReservations(2, 3)).toThrowError(
      expect.objectContaining({
        code: "INVENTORY_ADJUSTMENT_BELOW_RESERVED_STOCK",
        status: 409,
      })
    );
  });
});
