import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error";
import {
  aggregateCartDemand,
  assertAdjustmentCoversReservations,
  calculateAdjustment,
  calculateDownwardThresholdCrossing,
  calculateRestock,
  deriveStockStatus,
  getAvailableQuantity,
  validateStockDemand,
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

describe("validateStockDemand", () => {
  it("validates sufficient stock across mixed tracked and untracked products", () => {
    const demand = new Map<number, number>([
      [1, 2], // tracked, onHand 10, reserved 3 -> available 7 >= 2
      [2, 5], // untracked, onHand null -> unlimited
    ]);

    const allocations = validateStockDemand({
      demandByProduct: demand,
      storeProducts: [
        { id: 101, productId: 1, onHandQuantity: 10, lowStockThreshold: 5 },
        { id: 102, productId: 2, onHandQuantity: null, lowStockThreshold: 5 },
      ],
      reservedQuantities: new Map([[101, 3]]),
      productNameMap: new Map([
        [1, "Margherita"],
        [2, "Garlic Bread"],
      ]),
    });

    expect(allocations).toEqual([
      {
        storeProductId: 101,
        productId: 1,
        productName: "Margherita",
        demandedQuantity: 2,
        isTracked: true,
        onHandQuantity: 10,
        reservedQuantity: 3,
        availableQuantity: 7,
        lowStockThreshold: 5,
      },
      {
        storeProductId: 102,
        productId: 2,
        productName: "Garlic Bread",
        demandedQuantity: 5,
        isTracked: false,
        onHandQuantity: null,
        reservedQuantity: 0,
        availableQuantity: null,
        lowStockThreshold: 5,
      },
    ]);
  });

  it("throws INSUFFICIENT_STOCK containing all insufficient items", () => {
    const demand = new Map<number, number>([
      [1, 5], // available 3 < 5
      [2, 4], // available 2 < 4
      [3, 1], // available 10 >= 1
    ]);

    expect(() =>
      validateStockDemand({
        demandByProduct: demand,
        storeProducts: [
          { id: 101, productId: 1, onHandQuantity: 5, lowStockThreshold: 2 },
          { id: 102, productId: 2, onHandQuantity: 2, lowStockThreshold: 2 },
          { id: 103, productId: 3, onHandQuantity: 10, lowStockThreshold: 2 },
        ],
        reservedQuantities: new Map([[101, 2]]),
        productNameMap: new Map([
          [1, "Margherita"],
          [2, "Pepperoni"],
          [3, "Coke"],
        ]),
      })
    ).toThrowError(
      expect.objectContaining({
        code: "INSUFFICIENT_STOCK",
        status: 409,
        data: {
          items: [
            {
              productId: 1,
              productName: "Margherita",
              requestedQuantity: 5,
              availableQuantity: 3,
            },
            {
              productId: 2,
              productName: "Pepperoni",
              requestedQuantity: 4,
              availableQuantity: 2,
            },
          ],
        },
      })
    );
  });

  it("throws STORE_PRODUCT_NOT_FOUND when mapping is missing", () => {
    const demand = new Map<number, number>([[99, 1]]);

    expect(() =>
      validateStockDemand({
        demandByProduct: demand,
        storeProducts: [],
        reservedQuantities: new Map(),
        productNameMap: new Map([[99, "Mystery Pizza"]]),
      })
    ).toThrowError(
      expect.objectContaining({
        code: "STORE_PRODUCT_NOT_FOUND",
        status: 404,
      })
    );
  });
});

describe("calculateDownwardThresholdCrossing", () => {
  it("emits low_stock when crossing downward to threshold", () => {
    const alert = calculateDownwardThresholdCrossing({
      storeId: 1,
      storeName: "Main Branch",
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      availableBefore: 12,
      availableAfter: 10,
      threshold: 10,
    });

    expect(alert).toEqual({
      storeId: 1,
      storeName: "Main Branch",
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      currentQuantity: 10,
      threshold: 10,
      severity: "low_stock",
    });
  });

  it("emits out_of_stock when crossing downward to 0", () => {
    const alert = calculateDownwardThresholdCrossing({
      storeId: 1,
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      availableBefore: 5,
      availableAfter: 0,
      threshold: 10,
    });

    expect(alert).toEqual({
      storeId: 1,
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      currentQuantity: 0,
      threshold: 10,
      severity: "out_of_stock",
    });
  });

  it("returns null if stock was already at or below threshold", () => {
    const alert = calculateDownwardThresholdCrossing({
      storeId: 1,
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      availableBefore: 8,
      availableAfter: 4,
      threshold: 10,
    });

    expect(alert).toBeNull();
  });

  it("returns null if stock remains above threshold", () => {
    const alert = calculateDownwardThresholdCrossing({
      storeId: 1,
      storeProductId: 101,
      productId: 7,
      productName: "Margherita",
      availableBefore: 20,
      availableAfter: 15,
      threshold: 10,
    });

    expect(alert).toBeNull();
  });
});
