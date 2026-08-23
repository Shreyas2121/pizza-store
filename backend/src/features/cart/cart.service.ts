import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  cartItemCustomizationsTable,
  cartItemsTable,
  cartTable,
  productsTable,
  storeProductsTable,
  storesTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { TransactionType } from "../../utils/types";
import customizeService from "../customization/customize.service";

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

      let cartId: number;
      let cartCleared = false;

      const existingCart = await this.getExistingCart(userId, tx);

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
            .set({ storeId, totalPrice: 0 })
            .where(eq(cartTable.id, existingCart.id));
        }

        await tx
          .update(cartTable)
          .set({
            storeId,
            totalPrice: sql`COALESCE(${cartTable.totalPrice}, 0) + ${storeProduct.price}`,
          })
          .where(eq(cartTable.id, existingCart.id));
      } else {
        const [{ id }] = await tx
          .insert(cartTable)
          .values({
            userId,
            storeId,
            totalPrice: storeProduct.price,
          })
          .returning();
        cartId = id;
      }

      const [cartItem] = await this.addToCartItem(
        { cartId, productId, price: storeProduct.price },
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
                  price: option.price!,
                },
                tx
              );
            }

            await this.updateCartPrice(cartId, option.price!, tx);
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
    const [storeProduct] = await dbT
      .select({
        price: storeProductsTable.price,
        isAvailable: storeProductsTable.isAvailable,
        productIsAvailable: productsTable.isAvailable,
        hasCustomization: productsTable.hasCustomization,
        storeIsActive: storesTable.isActive,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .innerJoin(storesTable, eq(storeProductsTable.storeId, storesTable.id))
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

    return storeProduct;
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
    newTotalPrice: number,
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;
    return await dbT
      .update(cartTable)
      .set({
        totalPrice: sql`COALESCE(${cartTable.totalPrice}, 0) + ${newTotalPrice}`,
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

  async getCart(userId: number) {
    return await db.query.cartTable.findFirst({
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
      await this.getAvailableStoreProduct(cart.storeId, productId);
    }

    if (type === "-" && cartItem.quantity! <= 1) {
      return await this.deleteCartItem(cartItemId);
    }

    let updatedPrice =
      cartItem.customizations.reduce((prev, curr) => prev + curr.price, 0) +
      cartItem.price;

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
          totalPrice: sql`${cartTable.totalPrice} + ${updatedPrice}`,
        })
        .where(eq(cartTable.id, cartItem.cartId));
    });
  }

  async updateCartItemCustomizations(cartItemId: number, userId: number, cIds: number[]) {
    const cart = await this.getExistingCart(userId);
    const cartItem = await this.getCartItemById(cartItemId);
    if (!cart || cartItem.cartId !== cart.id) throw new AppError("Cart item not found", 404);

    const uniqueIds = [...new Set(cIds)];
    const options = await Promise.all(uniqueIds.map((id) => customizeService.getCustomizationOptionById(id)));
    if (options.some((option) => !option || !option.isAvailable)) throw new AppError("One or more customization options are unavailable", 400);

    const oldExtras = cartItem.customizations.reduce((sum, option) => sum + option.price, 0);
    const newExtras = options.reduce((sum, option) => sum + (option?.price ?? 0), 0);
    const priceDifference = (newExtras - oldExtras) * cartItem.quantity;

    await db.transaction(async (tx) => {
      await tx.delete(cartItemCustomizationsTable).where(eq(cartItemCustomizationsTable.cartItemId, cartItemId));
      if (options.length > 0) {
        await tx.insert(cartItemCustomizationsTable).values(options.map((option) => ({ cartItemId, customizationOptionId: option!.id, price: option!.price ?? 0 })));
      }
      await tx.update(cartTable).set({ totalPrice: sql`${cartTable.totalPrice} + ${priceDifference}` }).where(eq(cartTable.id, cart.id));
    });
  }

  async deleteCartItem(itemId: number) {
    return await db.transaction(async (tx) => {
      const cartItem = await this.getCartItemById(itemId);

      const updatedPrice =
        (cartItem.price +
          cartItem.customizations.reduce((prev, curr) => prev + curr.price, 0)) *
        cartItem.quantity;

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));

      await tx
        .update(cartTable)
        .set({
          totalPrice: sql`${cartTable.totalPrice} - ${updatedPrice}`,
        })
        .where(eq(cartTable.id, cartItem.cartId));
    });
  }
}

export default new CartService();
