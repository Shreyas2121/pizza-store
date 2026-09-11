import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  addressTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";

export const publicQuoteRepository = {
  async findAddressState(addressId: number, userId: number) {
    const [address] = await db
      .select({ state: addressTable.state })
      .from(addressTable)
      .where(and(eq(addressTable.id, addressId), eq(addressTable.userId, userId)))
      .limit(1);
    return address?.state;
  },

  async findStoreProducts(storeId: number, productIds: number[]) {
    return db
      .select({
        productId: productsTable.id,
        productName: productsTable.name,
        pricePaise: storeProductsTable.pricePaise,
        productIsAvailable: productsTable.isAvailable,
        storeProductIsAvailable: storeProductsTable.isAvailable,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          inArray(storeProductsTable.productId, productIds)
        )
      );
  },

  async findProductCustomizationOptions(
    productIds: number[],
    optionIds: number[]
  ) {
    return db
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
          productCustomizationGroupMappingTable.groupId
        )
      )
      .where(
        and(
          inArray(productCustomizationGroupMappingTable.productId, productIds),
          inArray(customizationOptionsTable.id, optionIds)
        )
      );
  },
};
