import { and, asc, eq, inArray } from "drizzle-orm";
import {
  orderItemCustomizationsTable,
  orderItemBundleComponentsTable,
  orderItemsTable,
  ordersTable,
  addressTable,
  cartTable,
  usersTable,
  storesTable,
  storeProductsTable,
  productsTable,
  deliveryZonesTable,
  customizationOptionsTable,
  productCustomizationGroupMappingTable,
} from "../../db/schema";
import type { TransactionType } from "../../utils/types";
import { AppError } from "../../utils/error";
import { publicQuoteRepository } from "./checkout.repository";

export class CodCheckoutRepository {
  async insertOrder(
    value: typeof ordersTable.$inferInsert,
    tx: TransactionType,
  ) {
    const [order] = await tx.insert(ordersTable).values(value).returning();
    if (!order)
      throw new AppError(
        "Order persistence failed",
        500,
        "ORDER_PERSISTENCE_FAILED",
      );
    return order;
  }
  async insertItem(
    value: typeof orderItemsTable.$inferInsert,
    tx: TransactionType,
  ) {
    const [item] = await tx.insert(orderItemsTable).values(value).returning();
    if (!item)
      throw new AppError(
        "Order item persistence failed",
        500,
        "ORDER_PERSISTENCE_FAILED",
      );
    return item;
  }
  async insertCustomizations(
    values: (typeof orderItemCustomizationsTable.$inferInsert)[],
    tx: TransactionType,
  ) {
    if (values.length)
      await tx.insert(orderItemCustomizationsTable).values(values);
  }
  async insertBundleComponents(
    values: (typeof orderItemBundleComponentsTable.$inferInsert)[],
    tx: TransactionType,
  ) {
    if (values.length)
      await tx.insert(orderItemBundleComponentsTable).values(values);
  }

  async lockCart(userId: number, tx: TransactionType) {
    const [cart] = await tx
      .select({ id: cartTable.id })
      .from(cartTable)
      .where(eq(cartTable.userId, userId))
      .for("update")
      .limit(1);
    if (!cart) throw new AppError("Cart is empty", 400, "CART_EMPTY");
    return publicQuoteRepository.findOwnedCart(userId, tx);
  }
  async lockUser(userId: number, tx: TransactionType) {
    const [user] = await tx
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update");
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  async lockStore(storeId: number, tx: TransactionType) {
    const [store] = await tx
      .select()
      .from(storesTable)
      .where(eq(storesTable.id, storeId))
      .for("update");
    if (!store || !store.isActive)
      throw new AppError("Store is unavailable", 409, "STORE_NOT_FOUND");
    return store;
  }
  async address(
    userId: number,
    addressId: number,
    storeId: number,
    tx: TransactionType,
  ) {
    const [address] = await tx
      .select()
      .from(addressTable)
      .where(
        and(eq(addressTable.id, addressId), eq(addressTable.userId, userId)),
      )
      .limit(1);
    if (!address)
      throw new AppError(
        "Delivery address not found",
        404,
        "ADDRESS_NOT_FOUND",
      );
    const [zone] = await tx
      .select({ id: deliveryZonesTable.id })
      .from(deliveryZonesTable)
      .where(
        and(
          eq(deliveryZonesTable.storeId, storeId),
          eq(deliveryZonesTable.pincode, address.pincode),
        ),
      )
      .limit(1);
    if (!zone)
      throw new AppError(
        "Delivery address is outside this store's delivery area",
        409,
        "DELIVERY_AREA_UNAVAILABLE",
      );
    return address;
  }
  async lockCatalogue(
    storeId: number,
    productIds: number[],
    optionIds: number[],
    tx: TransactionType,
  ) {
    // Read component identities before locks, then verify after acquiring the
    // complete product set. Never add lower-ID locks after partial acquisition.
    const before = await publicQuoteRepository.findBundleDefinitions(
      storeId,
      productIds,
      tx,
    );
    const ids = [
      ...new Set([
        ...productIds,
        ...[...before.values()].flatMap((b) =>
          b.components.map((c) => c.productId),
        ),
      ]),
    ];
    await tx
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(inArray(productsTable.id, ids))
      .orderBy(asc(productsTable.id))
      // Stabilize definitions without blocking FK key-share reads by promotion
      // rule writers that already hold their promotion lock.
      .for("no key update");
    const after = await publicQuoteRepository.findBundleDefinitions(
      storeId,
      productIds,
      tx,
    );
    const identity = (bundles: typeof before) =>
      JSON.stringify(
        [...bundles]
          .sort(([a], [b]) => a - b)
          .map(([id, bundle]) => [
            id,
            bundle.components.map((c) => [c.productId, c.quantityPerBundle]),
          ]),
      );
    if (identity(before) !== identity(after))
      throw new AppError(
        "Catalogue changed; retry checkout",
        409,
        "CHECKOUT_CATALOGUE_CHANGED",
      );
    await tx
      .select({ id: storeProductsTable.id })
      .from(storeProductsTable)
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          inArray(storeProductsTable.productId, ids),
        ),
      )
      .orderBy(asc(storeProductsTable.id))
      .for("update");
    if (optionIds.length) {
      await tx
        .select({ id: customizationOptionsTable.id })
        .from(customizationOptionsTable)
        .where(inArray(customizationOptionsTable.id, optionIds))
        .orderBy(asc(customizationOptionsTable.id))
        .for("no key update");
      await tx
        .select()
        .from(productCustomizationGroupMappingTable)
        .where(
          inArray(productCustomizationGroupMappingTable.productId, productIds),
        )
        .orderBy(
          asc(productCustomizationGroupMappingTable.productId),
          asc(productCustomizationGroupMappingTable.groupId),
        )
        .for("update");
    }
  }
}
