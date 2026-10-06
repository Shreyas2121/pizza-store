import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db";
import {
  addressTable,
  bundleComponentsTable,
  customizationOptionsTable,
  storeProductsTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { publicQuoteRepository } from "./checkout.repository";

describe("authoritative checkout catalogue executor", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("reads cart, address, store prices, options and bundles through the supplied transaction", async () => {
    const tables: unknown[] = [];
    const ownedCart = vi.fn(async () => ({
      storeId: 1,
      items: [
        {
          id: 101,
          productId: 11,
          quantity: 2,
          customizations: [{ customizationOptionId: 5 }],
        },
      ],
    }));
    const executor = {
      query: { cartTable: { findFirst: ownedCart } },
      select: () => ({
        from: (table: unknown) => {
          tables.push(table);
          const query = {
            where: () => query,
            innerJoin: () => query,
            leftJoin: () => query,
            limit: () => query,
            then: (resolve: (rows: unknown[]) => unknown) =>
              Promise.resolve(
                table === addressTable ? [{ state: "Karnataka" }] : [],
              ).then(resolve),
          };
          return query;
        },
      }),
    };
    // This adapter implements the catalogue reads only and has no connection.
    const tx = executor as unknown as TransactionType;
    const globalSelect = vi.spyOn(db, "select").mockImplementation(() => {
      throw new Error("Read escaped checkout transaction");
    });
    const globalCart = vi
      .spyOn(db.query.cartTable, "findFirst")
      .mockRejectedValue(new Error("Read escaped checkout transaction"));
    expect(await publicQuoteRepository.findOwnedCart(7, tx)).toEqual({
      storeId: 1,
      items: [
        { id: 101, productId: 11, quantity: 2, customizationOptionIds: [5] },
      ],
    });
    expect(await publicQuoteRepository.findAddressState(2, 7, tx)).toBe(
      "Karnataka",
    );
    await publicQuoteRepository.findStoreProducts(1, [11], tx);
    await publicQuoteRepository.findProductCustomizationOptions([11], [5], tx);
    await publicQuoteRepository.findBundleDefinitions(1, [11], tx);
    expect(tables).toEqual([
      addressTable,
      storeProductsTable,
      customizationOptionsTable,
      bundleComponentsTable,
    ]);
    expect(ownedCart).toHaveBeenCalledTimes(1);
    expect(globalSelect).not.toHaveBeenCalled();
    expect(globalCart).not.toHaveBeenCalled();
  });
});
