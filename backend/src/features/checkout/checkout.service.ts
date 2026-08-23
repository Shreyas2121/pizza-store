import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  addressTable,
  cartTable,
  couponRedemptionsTable,
  couponsTable,
  deliveryZonesTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { paiseToRupees, rupeesToPaise } from "../../utils/money";
import type { CouponRedemptionStatus, TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import { formatStoreTime, isStoreOpen } from "../stores/store-hours";

type CheckoutCart = NonNullable<
  Awaited<ReturnType<typeof cartService.getCart>>
>;

const safeAdd = (left: number, right: number) => {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new AppError("Cart total is too large", 400);
  }
  return result;
};

export const calculateCartSubtotalPaise = (cart: CheckoutCart) => {
  try {
    return cart.items.reduce((subtotal, item) => {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new AppError("Cart contains an invalid quantity", 409);
      }

      const extrasPaise = item.customizations.reduce(
        (sum, customization) =>
          safeAdd(sum, rupeesToPaise(customization.price)),
        0
      );
      const unitPricePaise = safeAdd(rupeesToPaise(item.price), extrasPaise);
      const lineTotalPaise = unitPricePaise * item.quantity;

      if (!Number.isSafeInteger(lineTotalPaise)) {
        throw new AppError("Cart total is too large", 400);
      }

      return safeAdd(subtotal, lineTotalPaise);
    }, 0);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof RangeError) {
      throw new AppError("Cart contains invalid pricing", 409);
    }
    throw error;
  }
};

interface BuildCheckoutQuoteInput {
  userId: number;
  addressId: number;
  couponCode?: string | null;
}

class CheckoutService {
  async buildQuote(
    { userId, addressId, couponCode }: BuildCheckoutQuoteInput,
    tx: TransactionType
  ) {
    // Every cart mutation also updates/deletes the cart row. Locking it keeps
    // the quote and item snapshots stable until the checkout transaction ends.
    const [lockedCart] = await tx
      .select({ id: cartTable.id })
      .from(cartTable)
      .where(eq(cartTable.userId, userId))
      .for("update")
      .limit(1);

    if (!lockedCart) {
      throw new AppError("Cart is empty", 400);
    }

    const cart = await cartService.getCart(userId, tx);
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }
    if (cart.id !== lockedCart.id) {
      throw new AppError("Cart state is inconsistent. Please refresh and try again", 409);
    }
    if (!cart.storeId || !cart.store) {
      throw new AppError("Cart is not assigned to a store", 409);
    }
    if (!cart.store.isActive) {
      throw new AppError("Store is no longer active", 409);
    }
    if (!isStoreOpen(cart.store.opensAt, cart.store.closesAt)) {
      throw new AppError(
        `Store is currently closed. Opens at ${formatStoreTime(cart.store.opensAt)} IST`,
        409
      );
    }

    const [address] = await tx
      .select()
      .from(addressTable)
      .where(and(eq(addressTable.id, addressId), eq(addressTable.userId, userId)))
      .limit(1);

    if (!address) {
      throw new AppError("Delivery address not found", 404);
    }

    const [deliveryZone] = await tx
      .select({ id: deliveryZonesTable.id })
      .from(deliveryZonesTable)
      .where(
        and(
          eq(deliveryZonesTable.storeId, cart.storeId),
          eq(deliveryZonesTable.pincode, address.pincode)
        )
      )
      .limit(1);

    if (!deliveryZone) {
      throw new AppError(
        "Delivery address is outside this store's delivery area",
        409
      );
    }

    await this.assertProductsAvailable(cart, tx);

    const subtotalPaise = calculateCartSubtotalPaise(cart);
    const coupon = couponCode
      ? await this.getValidCoupon(couponCode, subtotalPaise, tx)
      : null;
    const discountPaise = coupon
      ? this.calculateDiscountPaise(coupon, subtotalPaise)
      : 0;
    const totalPaise = subtotalPaise - discountPaise;

    return {
      cart,
      address,
      coupon,
      subtotalPaise,
      subtotalRupees: paiseToRupees(subtotalPaise),
      discountPaise,
      discountRupees: paiseToRupees(discountPaise),
      totalPaise,
      totalRupees: paiseToRupees(totalPaise),
    };
  }

  async getCartSubtotalRupees(userId: number) {
    const cart = await cartService.getCart(userId);
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }
    return paiseToRupees(calculateCartSubtotalPaise(cart));
  }

  async recordCouponUse(
    data: {
      couponId: number;
      orderId: number;
      userId: number;
      status: Extract<CouponRedemptionStatus, "reserved" | "consumed">;
    },
    tx: TransactionType
  ) {
    const now = new Date();
    await tx.insert(couponRedemptionsTable).values({
      couponId: data.couponId,
      orderId: data.orderId,
      userId: data.userId,
      status: data.status,
      consumedAt: data.status === "consumed" ? now : null,
    });

    if (data.status === "consumed") {
      await tx
        .update(couponsTable)
        .set({
          redemptionCount: sql`${couponsTable.redemptionCount} + 1`,
        })
        .where(eq(couponsTable.id, data.couponId));
    }
  }

  private async assertProductsAvailable(cart: CheckoutCart, tx: TransactionType) {
    const productIds = [...new Set(cart.items.map((item) => item.productId))];
    const storeProducts = await tx
      .select({
        productId: storeProductsTable.productId,
        isAvailable: storeProductsTable.isAvailable,
        productIsAvailable: productsTable.isAvailable,
      })
      .from(storeProductsTable)
      .innerJoin(
        productsTable,
        eq(storeProductsTable.productId, productsTable.id)
      )
      .where(
        and(
          eq(storeProductsTable.storeId, cart.storeId!),
          inArray(storeProductsTable.productId, productIds)
        )
      );

    const availableProductIds = new Set(
      storeProducts
        .filter((mapping) => mapping.isAvailable && mapping.productIsAvailable)
        .map((mapping) => mapping.productId)
    );
    const unavailableItems = [
      ...new Set(
        cart.items
          .filter((item) => !availableProductIds.has(item.productId))
          .map((item) => item.product.name)
      ),
    ];

    if (unavailableItems.length > 0) {
      throw new AppError(`Unavailable items: ${unavailableItems.join(", ")}`, 409);
    }
  }

  private async getValidCoupon(
    code: string,
    subtotalPaise: number,
    tx: TransactionType
  ) {
    const normalizedCode = code.trim().toUpperCase();
    const [coupon] = await tx
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, normalizedCode))
      .for("update")
      .limit(1);

    if (!coupon) throw new AppError("Coupon not found", 404);

    const now = new Date();
    if (!coupon.isActive) throw new AppError("Coupon is not active", 400);
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError("Coupon is expired or not yet valid", 400);
    }
    if (!Number.isFinite(coupon.discountValue) || coupon.discountValue <= 0) {
      throw new AppError("Coupon has an invalid discount", 400);
    }

    if (!Number.isFinite(coupon.minOrderValue) || coupon.minOrderValue < 0) {
      throw new AppError("Coupon has an invalid minimum order value", 400);
    }
    const minimumPaise = rupeesToPaise(coupon.minOrderValue);
    if (subtotalPaise < minimumPaise) {
      throw new AppError(
        `Minimum order value of ${coupon.minOrderValue} not met`,
        400
      );
    }

    const [usage] = await tx
      .select({ active: count(couponRedemptionsTable.id) })
      .from(couponRedemptionsTable)
      .where(
        and(
          eq(couponRedemptionsTable.couponId, coupon.id),
          inArray(couponRedemptionsTable.status, ["reserved", "consumed"])
        )
      );
    const activeUsage = Math.max(coupon.redemptionCount, Number(usage.active));
    if (coupon.maxRedemptions >= 0 && activeUsage >= coupon.maxRedemptions) {
      throw new AppError("Coupon maximum redemption limit reached", 400);
    }

    return coupon;
  }

  private calculateDiscountPaise(
    coupon: typeof couponsTable.$inferSelect,
    subtotalPaise: number
  ) {
    if (
      coupon.discountType !== "percentage" &&
      coupon.discountType !== "fixed"
    ) {
      throw new AppError("Coupon has an invalid discount type", 400);
    }

    const rawDiscount =
      coupon.discountType === "percentage"
        ? Math.round((subtotalPaise * coupon.discountValue) / 100)
        : rupeesToPaise(coupon.discountValue);

    if (!Number.isSafeInteger(rawDiscount) || rawDiscount < 0) {
      throw new AppError("Coupon has an invalid discount", 400);
    }
    return Math.min(rawDiscount, subtotalPaise);
  }
}

export default new CheckoutService();
