import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  cartItemCustomizationsTable,
  cartItemsTable,
  cartTable,
  inventoryReservationsTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { TransactionType } from "../../utils/types";
import customizeService from "../customization/customize.service";
import { getAvailableQuantity } from "../inventory/inventory.logic";
import bundleService from "../bundles/bundle.service";

class CartService {
  /**
   * Adds a product to the cart. If the user already has a cart, update it.
   * If the product exists in the cart, increase its quantity; otherwise, add a new entry.
   */
  async addToCart({
    productId,
    storeId,
    userId,
    cIds = [],
  }: {
    productId: number;
    storeId: number;
    userId: number;
    cIds: number[];
  }) {
    return await db.transaction(async (tx) => {
      const storeProduct = await this.getAvailableStoreProduct(
        storeId,
        productId,
        tx
      );

      if (storeProduct.hasCustomization && cIds.length === 0) {
        throw new AppError("Customization options are required");
      }
      if (storeProduct.productType === "bundle" && cIds.length > 0) {
        throw new AppError("Bundles cannot be customized", 409, "BUNDLE_DEFINITION_INVALID");
      }

      let cartId: number;
      let cartCleared = false;

      const existingCart = await this.getExistingCart(userId, tx);

      let existingQuantityInCart = 0;
      if (existingCart && existingCart.storeId === storeId) {
        const cartItems = await tx
          .select({ quantity: cartItemsTable.quantity })
          .from(cartItemsTable)
          .where(
            and(
              eq(cartItemsTable.cartId, existingCart.id),
              eq(cartItemsTable.productId, productId)
            )
          );
        existingQuantityInCart = cartItems.reduce(
          (sum, item) => sum + (item.quantity ?? 0),
          0
        );
      }

      const requestedTotalQuantity = existingQuantityInCart + 1;
      if (
        storeProduct.isTracked &&
        storeProduct.availableQuantity !== null &&
        requestedTotalQuantity > storeProduct.availableQuantity
      ) {
        throw new AppError(
          "Insufficient stock for one or more items",
          409,
          "INSUFFICIENT_STOCK",
          {
            items: [
              {
                productId,
                productName: storeProduct.productName,
                requestedQuantity: requestedTotalQuantity,
                availableQuantity: storeProduct.availableQuantity,
              },
            ],
          }
        );
      }

      if (existingCart) {
        cartId = existingCart.id;

        if (existingCart.storeId !== storeId) {
          const removedItems = await tx
            .delete(cartItemsTable)
            .where(eq(cartItemsTable.cartId, existingCart.id))
            .returning({ id: cartItemsTable.id });
          cartCleared = removedItems.length > 0;

          await tx
            .update(cartTable)
            .set({ storeId, totalPaise: 0 })
            .where(eq(cartTable.id, existingCart.id));
        }

        await tx
          .update(cartTable)
          .set({
            storeId,
            totalPaise: sql`COALESCE(${cartTable.totalPaise}, 0) + ${storeProduct.pricePaise}`,
          })
          .where(eq(cartTable.id, existingCart.id));
      } else {
        const [{ id }] = await tx
          .insert(cartTable)
          .values({
            userId,
            storeId,
            totalPaise: storeProduct.pricePaise,
          })
          .returning();
        cartId = id;
      }

      const [cartItem] = await this.addToCartItem(
        { cartId, productId, pricePaise: storeProduct.pricePaise },
        cIds,
        tx
      );

      if (cIds.length > 0) {
        await Promise.all(
          cIds.map(async (id: number) => {
            const option = await customizeService.getCustomizationOptionById(
              id
            );
            if (!option || !option.isAvailable) {
              throw new AppError("Invalid or unavailable customization option");
            }

            const existingCustomization =
              await tx.query.cartItemCustomizationsTable.findFirst({
                where: and(
                  eq(cartItemCustomizationsTable.cartItemId, cartItem.id),
                  eq(cartItemCustomizationsTable.customizationOptionId, id)
                ),
              });

            if (!existingCustomization) {
              await this.createCartCustomization(
                {
                  cartItemId: cartItem.id,
                  customizationOptionId: id,
                  pricePaise: option.pricePaise,
                },
                tx
              );
            }

            await this.updateCartPrice(cartId, option.pricePaise, tx);
          })
        );
      }

      return { cartCleared, storeId };
    });
  }

  async getAvailableStoreProduct(
    storeId: number,
    productId: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    const now = new Date();

    const activeReservationsSubquery = dbT
      .select({
        storeProductId: inventoryReservationsTable.storeProductId,
        reservedQuantity:
          sql<number>`COALESCE(SUM(${inventoryReservationsTable.quantity}), 0)`
            .mapWith(Number)
            .as("reserved_quantity"),
      })
      .from(inventoryReservationsTable)
      .where(
        and(
          eq(inventoryReservationsTable.status, "reserved"),
          gt(inventoryReservationsTable.expiresAt, now)
        )
      )
      .groupBy(inventoryReservationsTable.storeProductId)
      .as("active_reservations");

    const [storeProduct] = await dbT
      .select({
        id: storeProductsTable.id,
        pricePaise: storeProductsTable.pricePaise,
        isAvailable: storeProductsTable.isAvailable,
        onHandQuantity: storeProductsTable.onHandQuantity,
        lowStockThreshold: storeProductsTable.lowStockThreshold,
        reservedQuantity:
          sql<number>`COALESCE(${activeReservationsSubquery.reservedQuantity}, 0)`.mapWith(
            Number
          ),
        productName: productsTable.name,
        productIsAvailable: productsTable.isAvailable,
        hasCustomization: productsTable.hasCustomization,
        productType: productsTable.productType,
        storeIsActive: storesTable.isActive,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .innerJoin(storesTable, eq(storeProductsTable.storeId, storesTable.id))
      .leftJoin(
        activeReservationsSubquery,
        eq(storeProductsTable.id, activeReservationsSubquery.storeProductId)
      )
      .where(
        and(
          eq(storeProductsTable.storeId, storeId),
          eq(storeProductsTable.productId, productId)
        )
      )
      .limit(1);

    if (!storeProduct) {
      throw new AppError("Product is not offered by this store", 404);
    }
    if (!storeProduct.storeIsActive) {
      throw new AppError("Store is no longer active", 409);
    }
    if (!storeProduct.productIsAvailable || !storeProduct.isAvailable) {
      throw new AppError("Product is not available at this store", 409);
    }

    if (storeProduct.productType === "bundle") {
      if (storeProduct.hasCustomization) {
        throw new AppError("Bundles cannot have customizations", 409, "BUNDLE_DEFINITION_INVALID");
      }
      const bundle = await bundleService.getPublicBundle(productId, storeId, tx);
      if (!bundle.isAvailable) {
        throw new AppError("One or more bundle components are unavailable", 409, "BUNDLE_COMPONENT_UNAVAILABLE", {
          bundleProductId: productId,
          unavailableComponentIds: bundle.unavailableComponentIds,
        });
      }
    }

    const isTracked = storeProduct.onHandQuantity !== null;
    const availableQuantity = isTracked
      ? getAvailableQuantity(
          storeProduct.onHandQuantity,
          storeProduct.reservedQuantity
        )
      : null;

    return {
      ...storeProduct,
      isTracked,
      availableQuantity,
    };
  }

  async addToCartItem(
    data: typeof cartItemsTable.$inferInsert,
    CIds: number[],
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;

    const existingCartItem = await this.checkProductInCart(
      data.cartId,
      data.productId,
      tx
    );

    if (existingCartItem) {
      const existingCartCustomization =
        await dbT.query.cartItemCustomizationsTable.findMany({
          where: and(
            eq(cartItemCustomizationsTable.cartItemId, existingCartItem.id)
          ),
        });

      const existingIds = existingCartCustomization.map(
        (item) => item.customizationOptionId
      );

      const isExactMatch =
        existingIds.length === CIds.length &&
        existingIds.sort().join(",") === CIds.sort().join(",");

      if (isExactMatch) {
        return await dbT
          .update(cartItemsTable)
          .set({
            quantity: sql`COALESCE(${cartItemsTable.quantity}, 0) + 1`,
          })
          .where(eq(cartItemsTable.id, existingCartItem.id))
          .returning();
      } else {
        return await dbT.insert(cartItemsTable).values(data).returning();
      }
    } else {
      return await dbT.insert(cartItemsTable).values(data).returning();
    }
  }

  async getExistingCart(userId: number, tx?: TransactionType) {
    const dbT = tx ?? db;
    return await dbT.query.cartTable.findFirst({
      where: eq(cartTable.userId, userId),
    });
  }

  async updateCartItem(
    data: Partial<typeof cartItemsTable.$inferInsert>,
    id: number
  ) {
    await db.update(cartItemsTable).set(data).where(eq(cartItemsTable.id, id));
  }

  async checkProductInCart(
    cartId: number,
    productId: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    return await dbT.query.cartItemsTable.findFirst({
      where: and(
        eq(cartItemsTable.cartId, cartId),
        eq(cartItemsTable.productId, productId)
      ),
    });
  }

  async getCartItems(cartId: number) {
    return await db.query.cartItemsTable.findMany({
      where: eq(cartItemsTable.cartId, cartId),
    });
  }

  // Cart Customization

  async createCartCustomization(
    data: typeof cartItemCustomizationsTable.$inferInsert,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    return await dbT
      .insert(cartItemCustomizationsTable)
      .values(data)
      .returning();
  }

  async updateCartPrice(
    cartId: number,
    amountPaise: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    return await dbT
      .update(cartTable)
      .set({
        totalPaise: sql`COALESCE(${cartTable.totalPaise}, 0) + ${amountPaise}`,
      })
      .where(eq(cartTable.id, cartId));
  }

  async getCartCount(userId: number) {
    const cart = await this.getExistingCart(userId);
    if (!cart) return 0;

    const [{ count: itemsCount }] = await db
      .select({
        count: count(cartItemsTable.id),
      })
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, cart.id));

    return itemsCount;
  }

  async getCart(userId: number, tx?: TransactionType) {
    const dbT = tx ?? db;
    const cart = await dbT.query.cartTable.findFirst({
      where: eq(cartTable.userId, userId),
      with: {
        store: true,
        items: {
          with: {
            product: true,
            customizations: {
              with: {
                customizationOption: true,
              },
            },
          },
        },
      },
    });
    return cart ? bundleService.decorateCart(cart, tx) : cart;
  }

  async clearCart(userId: number, tx?: TransactionType) {
    const dbT = tx ?? db;
    const cart = await this.getExistingCart(userId, tx);
    if (!cart) return;

    await dbT.delete(cartTable).where(eq(cartTable.id, cart.id));
  }

  async getCartItemById(id: number) {
    const cartItem = await db.query.cartItemsTable.findFirst({
      with: {
        customizations: true,
      },
      where: and(eq(cartItemsTable.id, id)),
    });
    if (!cartItem) throw new AppError("Cart item not found");

    return cartItem;
  }

  async assertCartItemOwner(cartItemId: number, userId: number) {
    const cart = await this.getExistingCart(userId);
    const item = await this.getCartItemById(cartItemId);
    if (!cart || item.cartId !== cart.id) throw new AppError("Cart item not found", 404);
    return item;
  }

  async updateCartItemByType({
    cartItemId,
    productId,
    type,
    userId,
  }: {
    cartItemId: number;
    productId: number;
    type: "+" | "-";
    userId: number;
  }) {
    const cartItem = await this.assertCartItemOwner(cartItemId, userId);

    if (cartItem.productId !== productId) {
      throw new AppError("Cart item does not match product", 400);
    }

    if (type === "+") {
      const cart = await this.getExistingCart(userId);
      if (!cart?.storeId) {
        throw new AppError("Cart is not assigned to a store", 409);
      }
      const storeProduct = await this.getAvailableStoreProduct(
        cart.storeId,
        productId
      );

      const cartItems = await db
        .select({ quantity: cartItemsTable.quantity })
        .from(cartItemsTable)
        .where(
          and(
            eq(cartItemsTable.cartId, cart.id),
            eq(cartItemsTable.productId, productId)
          )
        );
      const existingQuantityInCart = cartItems.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0
      );

      const requestedTotalQuantity = existingQuantityInCart + 1;
      if (
        storeProduct.isTracked &&
        storeProduct.availableQuantity !== null &&
        requestedTotalQuantity > storeProduct.availableQuantity
      ) {
        throw new AppError(
          "Insufficient stock for one or more items",
          409,
          "INSUFFICIENT_STOCK",
          {
            items: [
              {
                productId,
                productName: storeProduct.productName,
                requestedQuantity: requestedTotalQuantity,
                availableQuantity: storeProduct.availableQuantity,
              },
            ],
          }
        );
      }
    }

    if (type === "-" && cartItem.quantity! <= 1) {
      return await this.deleteCartItem(cartItemId);
    }

    let updatedPrice =
      cartItem.customizations.reduce((prev, curr) => prev + curr.pricePaise, 0) +
      cartItem.pricePaise;

    return await db.transaction(async (tx) => {
      const currentQuantity = cartItem.quantity!;
      const newQuantity =
        type === "+" ? currentQuantity + 1 : Math.max(currentQuantity - 1, 0);

      await tx
        .update(cartItemsTable)
        .set({
          quantity: newQuantity,
        })
        .where(eq(cartItemsTable.id, cartItem.id));

      updatedPrice = type === "+" ? +updatedPrice : -updatedPrice;

      await tx
        .update(cartTable)
        .set({
          totalPaise: sql`${cartTable.totalPaise} + ${updatedPrice}`,
        })
        .where(eq(cartTable.id, cartItem.cartId));
    });
  }

  async updateCartItemCustomizations(cartItemId: number, userId: number, cIds: number[]) {
    const cart = await this.getExistingCart(userId);
    const cartItem = await this.getCartItemById(cartItemId);
    if (!cart || cartItem.cartId !== cart.id) throw new AppError("Cart item not found", 404);

    const product = await db.query.productsTable.findFirst({
      where: eq(productsTable.id, cartItem.productId),
      columns: { productType: true },
    });
    if (product?.productType === "bundle" && cIds.length > 0) {
      throw new AppError("Bundles cannot be customized", 409, "BUNDLE_DEFINITION_INVALID");
    }

    const uniqueIds = [...new Set(cIds)];
    const options = await Promise.all(uniqueIds.map((id) => customizeService.getCustomizationOptionById(id)));
    if (options.some((option) => !option || !option.isAvailable)) throw new AppError("One or more customization options are unavailable", 400);

    const oldExtras = cartItem.customizations.reduce((sum, option) => sum + option.pricePaise, 0);
    const newExtras = options.reduce((sum, option) => sum + (option?.pricePaise ?? 0), 0);
    const priceDifference = (newExtras - oldExtras) * cartItem.quantity;

    await db.transaction(async (tx) => {
      await tx.delete(cartItemCustomizationsTable).where(eq(cartItemCustomizationsTable.cartItemId, cartItemId));
      if (options.length > 0) {
        await tx.insert(cartItemCustomizationsTable).values(options.map((option) => ({ cartItemId, customizationOptionId: option!.id, pricePaise: option!.pricePaise })));
      }
      await tx.update(cartTable).set({ totalPaise: sql`${cartTable.totalPaise} + ${priceDifference}` }).where(eq(cartTable.id, cart.id));
    });
  }

  async deleteCartItem(itemId: number) {
    return await db.transaction(async (tx) => {
      const cartItem = await this.getCartItemById(itemId);

      const updatedPrice =
        (cartItem.pricePaise +
          cartItem.customizations.reduce((prev, curr) => prev + curr.pricePaise, 0)) *
        cartItem.quantity;

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));

      await tx
        .update(cartTable)
        .set({
          totalPaise: sql`${cartTable.totalPaise} - ${updatedPrice}`,
        })
        .where(eq(cartTable.id, cartItem.cartId));
    });
  }
}

export default new CartService();
