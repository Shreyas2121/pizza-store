import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  addressTable,
  cartTable,
  couponRedemptionsTable,
  couponsTable,
  deliveryZonesTable,
  orderItemCustomizationsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  storeProductsTable,
} from "../../db/schema";
import { AppError } from "../../utils/error";
import { paiseToRupees, rupeesToPaise } from "../../utils/money";
import type { CouponRedemptionStatus, TransactionType } from "../../utils/types";
import cartService from "../cart/cart.service";
import inventoryService from "../inventory/inventory.service";
import pricingService, {
  type PricingItemInput,
} from "../pricing/pricing.service";
import { formatStoreTime, isStoreOpen } from "../stores/store-hours";

type CheckoutCart = NonNullable<
  Awaited<ReturnType<typeof cartService.getCart>>
>;

export const toPricingItems = (cart: CheckoutCart): PricingItemInput[] => {
  try {
    return cart.items.map((item) => ({
      lineId: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      baseUnitPricePaise: rupeesToPaise(item.price),
      customizations: item.customizations.map((customization) => ({
        customizationOptionId: customization.customizationOptionId,
        name: customization.customizationOption.name,
        pricePaise: rupeesToPaise(customization.price),
      })),
    }));
  } catch (error) {
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

interface CreateOrderSnapshotInput {
  userId: number;
  addressId: number;
  paymentId: number;
  paymentType: "cash" | "razorpay";
  status: "pending" | "awaiting_payment";
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
    const stockAllocations = await inventoryService.validateAndLockStock(
      cart.storeId,
      cart.items,
      tx
    );

    const { quote: pricingQuote, couponRecord: coupon } =
      await pricingService.buildQuote(
        { items: toPricingItems(cart), couponCode },
        { executor: tx, lockCoupon: true }
      );
    const subtotalPaise = pricingQuote.itemsSubtotalPaise;
    const discountPaise = pricingQuote.discountPaise;
    const totalPaise = pricingQuote.grandTotalPaise;

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
      pricingQuote,
      stockAllocations,
    };
  }

  async previewCoupon(userId: number, couponCode: string) {
    const cart = await cartService.getCart(userId);
    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400);
    }
    return await pricingService.buildQuote({
      items: toPricingItems(cart),
      couponCode,
    });
  }

  async createOrderSnapshot(
    quote: Awaited<ReturnType<CheckoutService["buildQuote"]>>,
    data: CreateOrderSnapshotInput,
    tx: TransactionType
  ) {
    const [order] = await tx
      .insert(ordersTable)
      .values({
        userId: data.userId,
        addressId: data.addressId,
        storeId: quote.cart.storeId!,
        couponId: quote.coupon?.id ?? null,
        discountAmount: quote.discountRupees,
        totalPrice: quote.totalRupees,
        paymentType: data.paymentType,
        paymentId: data.paymentId,
        status: data.status,
      })
      .returning();

    for (const item of quote.cart.items) {
      const [orderItem] = await tx
        .insert(orderItemsTable)
        .values({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })
        .returning();

      if (item.customizations.length > 0) {
        await tx.insert(orderItemCustomizationsTable).values(
          item.customizations.map((customization) => ({
            customizationOptionId: customization.customizationOptionId,
            orderItemId: orderItem.id,
            price: customization.price,
          }))
        );
      }
    }

    return order;
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

  async releaseCouponReservation(orderId: number, tx: TransactionType) {
    await tx
      .update(couponRedemptionsTable)
      .set({ status: "released", releasedAt: new Date() })
      .where(
        and(
          eq(couponRedemptionsTable.orderId, orderId),
          eq(couponRedemptionsTable.status, "reserved")
        )
      );
  }

  async consumeCouponReservation(
    data: { couponId: number; orderId: number; userId: number },
    tx: TransactionType
  ) {
    const [redemption] = await tx
      .select()
      .from(couponRedemptionsTable)
      .where(eq(couponRedemptionsTable.orderId, data.orderId))
      .for("update")
      .limit(1);

    if (!redemption) {
      await this.recordCouponUse(
        { ...data, status: "consumed" },
        tx
      );
      return true;
    }
    if (
      redemption.couponId !== data.couponId ||
      redemption.userId !== data.userId
    ) {
      throw new AppError("Coupon reservation does not match the order", 500);
    }
    if (redemption.status === "consumed") return false;

    await tx
      .update(couponRedemptionsTable)
      .set({ status: "consumed", consumedAt: new Date() })
      .where(eq(couponRedemptionsTable.id, redemption.id));
    await tx
      .update(couponsTable)
      .set({ redemptionCount: sql`${couponsTable.redemptionCount} + 1` })
      .where(eq(couponsTable.id, data.couponId));
    return true;
  }

  async restoreCouponReservation(
    data: { couponId: number; orderId: number },
    tx: TransactionType,
    enforceCapacity = true
  ) {
    const [redemption] = await tx
      .select()
      .from(couponRedemptionsTable)
      .where(
        and(
          eq(couponRedemptionsTable.orderId, data.orderId),
          eq(couponRedemptionsTable.couponId, data.couponId)
        )
      )
      .for("update")
      .limit(1);

    if (!redemption) {
      throw new AppError("Coupon reservation not found", 409);
    }
    if (redemption.status === "reserved") return;
    if (redemption.status === "consumed") {
      throw new AppError("Coupon has already been consumed", 409);
    }

    if (!enforceCapacity) {
      await tx
        .update(couponRedemptionsTable)
        .set({ status: "reserved", reservedAt: new Date(), releasedAt: null })
        .where(eq(couponRedemptionsTable.id, redemption.id));
      return;
    }

    const [coupon] = await tx
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.id, data.couponId))
      .for("update")
      .limit(1);

    if (!coupon || !coupon.isActive) {
      throw new AppError("Coupon is no longer available", 409);
    }

    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      throw new AppError("Coupon is expired or not yet valid", 409);
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
    if (
      enforceCapacity &&
      coupon.maxRedemptions >= 0 &&
      activeUsage >= coupon.maxRedemptions
    ) {
      throw new AppError("Coupon maximum redemption limit reached", 409);
    }

    await tx
      .update(couponRedemptionsTable)
      .set({ status: "reserved", reservedAt: now, releasedAt: null })
      .where(
        and(
          eq(couponRedemptionsTable.orderId, data.orderId),
          eq(couponRedemptionsTable.status, "released")
        )
      );
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

}

export default new CheckoutService();
