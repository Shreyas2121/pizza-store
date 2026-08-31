import { describe, expect, it } from "vitest";
import { orderGrandTotalRupees, toOrderResponse } from "./order.mapper";

describe("order exact snapshot mapper", () => {
  it("builds the legacy response shape only from immutable exact snapshots", () => {
    const response = toOrderResponse({
      id: 42,
      discountPaise: 10_000,
      grandTotalPaise: 40_000,
      discountAmount: 999,
      totalPrice: 999,
      items: [
        {
          productName: "Snapshot Pizza",
          unitPricePaise: 25_000,
          price: 999,
          product: { name: "Renamed Pizza", price: 999 },
          orderItemCustomizations: [
            {
              customizationName: "Snapshot Cheese",
              pricePaise: 5_000,
              price: 999,
              customizationOption: { name: "Renamed Cheese", price: 999 },
            },
          ],
        },
      ],
    });

    expect(response).toMatchObject({
      discountAmount: 100,
      totalPrice: 400,
      items: [
        {
          price: 200,
          product: { name: "Snapshot Pizza" },
          orderItemCustomizations: [
            {
              price: 50,
              customizationOption: {
                name: "Snapshot Cheese",
                price: 50,
              },
            },
          ],
        },
      ],
    });
  });

  it("supports zero totals and the configured order boundary", () => {
    expect(
      toOrderResponse({ discountPaise: 20_000, grandTotalPaise: 0 })
    ).toMatchObject({ discountAmount: 200, totalPrice: 0 });
    expect(
      orderGrandTotalRupees({ discountPaise: 0, grandTotalPaise: 500_000 })
    ).toBe(5_000);
  });

  it("never falls back to legacy floats when an exact snapshot is missing", () => {
    expect(() =>
      toOrderResponse({
        discountPaise: null,
        grandTotalPaise: null,
        discountAmount: 20,
        totalPrice: 180,
      })
    ).toThrowError(
      expect.objectContaining({ code: "ORDER_MONEY_SNAPSHOT_MISSING" })
    );
  });
});
