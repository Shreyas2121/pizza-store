import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { loadBundleDefinitions } from "../bundles/pricing";
import {
  addressTable,
  cartTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";

import type { DatabaseType, TransactionType } from "../../utils/types";
type Executor = DatabaseType | TransactionType;

export const publicQuoteRepository = {
  async findOwnedCart(userId: number, executor: Executor = db) {
    // Read identities only. Stored cart prices and bundle decoration must not
    // determine a new preview's current catalogue price or availability.
    const cart = await executor.query.cartTable.findFirst({
      where: eq(cartTable.userId, userId),
      columns: { storeId: true },
      with: {
        items: {
          columns: { id: true, productId: true, quantity: true },
          with: {
            customizations: { columns: { customizationOptionId: true } },
          },
        },
      },
    });
    return cart
      ? {
          storeId: cart.storeId,
          items: cart.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            customizationOptionIds: item.customizations.map(
              (option) => option.customizationOptionId,
            ),
          })),
        }
      : undefined;
  },
  async findBundleDefinitions(
    storeId: number,
    productIds: number[],
    executor: Executor = db,
  ) {
    return loadBundleDefinitions(productIds, storeId, executor);
  },
  async findAddressState(
    addressId: number,
    userId: number,
    executor: Executor = db,
  ) {
    const [address] = await executor
      .select({ state: addressTable.state })
      .from(addressTable)
      .where(
        and(eq(addressTable.id, addressId), eq(addressTable.userId, userId)),
      )
      .limit(1);
    return address?.state;
  },

  async findStoreProducts(
    storeId: number,
    productIds: number[],
    executor: Executor = db,
  ) {
    return executor
      .select({
        productId: productsTable.id,
        productName: productsTable.name,
        categoryId: productsTable.categoryId,
        productType: productsTable.productType,
        compareAtUnitPricePaise: storeProductsTable.compareAtPricePaise,
        pricePaise: storeProductsTable.pricePaise,
        productIsAvailable: productsTable.isAvailable,
        storeProductIsAvailable: storeProductsTable.isAvailable,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id),
      )
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          inArray(storeProductsTable.productId, productIds),
        ),
      );
  },

  async findProductCustomizationOptions(
    productIds: number[],
    optionIds: number[],
    executor: Executor = db,
  ) {
    return executor
      .select({
        productId: productCustomizationGroupMappingTable.productId,
        optionId: customizationOptionsTable.id,
        optionName: customizationOptionsTable.name,
        pricePaise: customizationOptionsTable.pricePaise,
        isAvailable: customizationOptionsTable.isAvailable,
      })
      .from(customizationOptionsTable)
      .innerJoin(
        productCustomizationGroupMappingTable,
        eq(
          customizationOptionsTable.groupId,
          productCustomizationGroupMappingTable.groupId,
        ),
      )
      .where(
        and(
          inArray(productCustomizationGroupMappingTable.productId, productIds),
          inArray(customizationOptionsTable.id, optionIds),
        ),
      );
  },
};
