import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import {
  cartTable,
  cartItemsTable,
  cartItemCustomizationsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import cartService from "./cart.service";
import customizeService from "../customization/customize.service";

const harness = () => {
  const events: Array<{ operation: string; table?: unknown }> = [];
  const now = new Date("2026-10-06");
  const item = {
    id: 5,
    cartId: 1,
    productId: 11,
    quantity: 2,
    pricePaise: 1000,
    createdAt: now,
    updatedAt: now,
    customizations: [],
  };
  const executor = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          for: (lock: string) => {
            events.push({ operation: lock, table });
            return { limit: async () => [{ id: 1 }] };
          },
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          events.push({ operation: "update", table });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        events.push({ operation: "delete", table });
      },
    }),
    query: {
      productsTable: { findFirst: async () => ({ productType: "single" }) },
    },
  };
  // Narrow in-memory adapter; all calls below are asserted, no database exists.
  const tx = executor as unknown as TransactionType;
  vi.spyOn(db, "transaction").mockImplementation(async (operation) => {
    events.push({ operation: "transaction" });
    return operation(tx);
  });
  vi.spyOn(cartService, "getExistingCart").mockImplementation(async () => {
    events.push({ operation: "read-cart" });
    return {
      id: 1,
      userId: 7,
      storeId: 1,
      totalPaise: 2000,
      createdAt: now,
      updatedAt: now,
    };
  });
  vi.spyOn(cartService, "getCartItemById").mockImplementation(async () => {
    events.push({ operation: "read-item" });
    return item;
  });
  return { tx, events, item };
};
describe("cart mutation locking", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("locks the parent before reading quantities and writing a child", async () => {
    const h = harness();
    await cartService.updateCartItemByType({
      cartItemId: 5,
      productId: 11,
      type: "-",
      userId: 7,
    });
    expect(h.events).toEqual([
      { operation: "transaction" },
      { operation: "update", table: cartTable },
      { operation: "read-cart" },
      { operation: "read-item" },
      { operation: "update", table: cartItemsTable },
      { operation: "update", table: cartTable },
    ]);
    expect(cartService.getCartItemById).toHaveBeenCalledWith(5, h.tx);
  });
  it("locks and re-reads the item before deleting, including the quantity-one decrement without nested transactions", async () => {
    const h = harness();
    h.item.quantity = 1;
    await cartService.updateCartItemByType({
      cartItemId: 5,
      productId: 11,
      type: "-",
      userId: 7,
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const deletion = h.events.findIndex((e) => e.operation === "delete");
    expect(h.events[deletion - 2]).toEqual({
      operation: "update",
      table: cartTable,
    });
    expect(h.events[deletion - 1]).toEqual({ operation: "read-item" });
  });
  it("locks the cart before customization replacement and uses one executor", async () => {
    const h = harness();
    vi.spyOn(customizeService, "getCustomizationOptionById");
    await cartService.updateCartItemCustomizations(5, 7, []);
    expect(h.events).toEqual([
      { operation: "transaction" },
      { operation: "update", table: cartTable },
      { operation: "read-cart" },
      { operation: "read-item" },
      { operation: "delete", table: cartItemCustomizationsTable },
      { operation: "update", table: cartTable },
    ]);
    expect(cartService.getExistingCart).toHaveBeenCalledWith(7, h.tx);
    expect(customizeService.getCustomizationOptionById).not.toHaveBeenCalled();
  });
});
