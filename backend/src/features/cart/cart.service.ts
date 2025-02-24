import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  cartItemCustomizationsTable,
  cartItemsTable,
  cartTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { TransactionType } from "../../utils/types";
import productService from "../products/product.service";
import customizeService from "../customization/customize.service";

class CartService {
  /**
   * Adds a product to the cart. If the user already has a cart, update it.
   * If the product exists in the cart, increase its quantity; otherwise, add a new entry.
   */
  async addToCart({
    productId,
    userId,
    cIds = [],
  }: {
    productId: number;
    userId: number;
    cIds: number[];
  }) {
    await db.transaction(async (tx) => {
      const product = await productService.getProductById(productId);

      if (!product) {
        throw new AppError("Product not found");
      }

      if (product.hasCustomization && cIds.length === 0) {
        throw new AppError("Customization options are required");
      }

      let cartId: number;

      const existingCart = await this.getExistingCart(userId);

      if (existingCart) {
        cartId = existingCart.id;
        await tx
          .update(cartTable)
          .set({
            totalPrice: sql`COALESCE(${cartTable.totalPrice}, 0) + ${product.price}`,
          })
          .where(eq(cartTable.id, existingCart.id));
      } else {
        const [{ id }] = await tx
          .insert(cartTable)
          .values({
            userId,
            totalPrice: product.price,
          })
          .returning();
        cartId = id;
      }

      const [cartItem] = await this.addToCartItem(
        { cartId, productId, price: product.price },
        cIds,
        tx
      );

      if (cIds.length > 0) {
        await Promise.all(
          cIds.map(async (id: number) => {
            const option = await customizeService.getCustomizationOptionById(
              id
            );
            if (!option) {
              tx.rollback();
              throw new AppError("Invalid customization option");
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
    });
  }

  async addToCartItem(
    data: typeof cartItemsTable.$inferInsert,
    CIds: number[],
    tx?: TransactionType
  ) {
    const dbT = tx ?? db;

    const existingCartItem = await this.checkProductInCart(
      data.cartId,
      data.productId
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

  async getExistingCart(userId: number) {
    return await db.query.cartTable.findFirst({
      where: eq(cartTable.userId, userId),
    });
  }

  async updateCartItem(
    data: Partial<typeof cartItemsTable.$inferInsert>,
    id: number
  ) {
    await db.update(cartItemsTable).set(data).where(eq(cartItemsTable.id, id));
  }

  async checkProductInCart(cartId: number, productId: number) {
    return await db.query.cartItemsTable.findFirst({
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
    const cart = await this.getExistingCart(userId);
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

  async updateCartItemByType({
    cartItemId,
    productId,
    type,
  }: {
    cartItemId: number;
    productId: number;
    type: "+" | "-";
  }) {
    const cartItem = await this.getCartItemById(cartItemId);

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

      await tx.update(cartTable).set({
        totalPrice: sql`${cartTable.totalPrice} + ${updatedPrice} `,
      });
    });
  }

  async deleteCartItem(itemId: number) {
    return await db.transaction(async (tx) => {
      const cartItem = await this.getCartItemById(itemId);

      const updatedPrice =
        cartItem.customizations.reduce((prev, curr) => prev + curr.price, 0) +
        cartItem.price * cartItem.quantity;

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.id, itemId));

      await tx.update(cartTable).set({
        totalPrice: sql`${cartTable.totalPrice} - ${updatedPrice}`,
      });
    });
  }
}

export default new CartService();
